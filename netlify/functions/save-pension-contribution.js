const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body)
});

const decodeBase64 = (content) => Buffer.from(content, 'base64').toString('utf8');
const encodeBase64 = (content) => Buffer.from(content, 'utf8').toString('base64');

const isValidDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''));

const getTarget = (payload) => {
  const target = String(payload.target || payload.item?.target || 'contribution').trim();
  return target === 'cashSnapshot' ? 'cashSnapshot' : 'contribution';
};

const getDataPath = (target) => {
  if (target === 'cashSnapshot') {
    return process.env.PENSION_CASH_SNAPSHOT_PATH || 'data/pension_cash_snapshots.json';
  }
  return process.env.PENSION_DATA_PATH || 'data/pension_contributions.json';
};

const normalizeArrayData = (doc, keyName) => {
  if (Array.isArray(doc)) return doc;
  if (doc && typeof doc === 'object' && Array.isArray(doc[keyName])) return doc[keyName];
  return [];
};

const crypto = require('crypto');

const pinFailStore = new Map();

const getClientKey = (event) => {
  const headers = event.headers || {};
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  const ip = String(forwarded).split(',')[0].trim();
  return ip || headers['client-ip'] || headers['x-real-ip'] || 'unknown';
};

const assertAdminPin = (event, payload, adminPin) => {
  if (!adminPin) return;

  const key = `pin:${getClientKey(event)}`;
  const now = Date.now();
  const state = pinFailStore.get(key) || { count: 0, lockedUntil: 0 };

  if (state.lockedUntil && now < state.lockedUntil) {
    const remainSec = Math.ceil((state.lockedUntil - now) / 1000);
    const error = new Error(`PIN 입력 실패가 많습니다. ${remainSec}초 후 다시 시도하세요.`);
    error.statusCode = 429;
    throw error;
  }

  const inputPin = String(payload.pin || '').trim();

  if (inputPin !== String(adminPin).trim()) {
    const nextCount = Number(state.count || 0) + 1;

    if (nextCount >= 5) {
      pinFailStore.set(key, {
        count: 0,
        lockedUntil: now + 10 * 60 * 1000
      });

      const error = new Error('PIN 입력 실패가 많습니다. 10분 후 다시 시도하세요.');
      error.statusCode = 429;
      throw error;
    }

    pinFailStore.set(key, {
      count: nextCount,
      lockedUntil: 0
    });

    const error = new Error(`PIN이 올바르지 않습니다. 실패 ${nextCount}/5회`);
    error.statusCode = 401;
    throw error;
  }

  pinFailStore.delete(key);
};


const nowKST = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
const newContributionId = (date) => `contrib-${date}-${crypto.randomUUID()}`;

const defaultContributionMemo = (date) => `${date.slice(0, 4)}년 ${Number(date.slice(5, 7))}월 기업적립금`;

const normalizeItemsForTarget = (items, target) => {
  if (target === 'cashSnapshot') {
    const map = new Map();

    for (const item of items || []) {
      if (!item || !isValidDate(item.date)) continue;
      const date = String(item.date).trim();

      map.set(date, {
        date,
        valuation: Math.round(Number(item.valuation) || 0),
        memo: String(item.memo || '').trim(),
        updatedBy: item.updatedBy || 'unknown',
        updatedAtKST: item.updatedAtKST || ''
      });
    }

    return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  return (items || [])
    .filter((item) => item && isValidDate(item.date))
    .map((item, index) => {
      const date = String(item.date).trim();
      return {
        id: item.id || `legacy-contrib-${date}-${index}`,
        date,
        amount: Math.round(Number(item.amount) || 0),
        memo: String(item.memo || '').trim(),
        updatedBy: item.updatedBy || item.source || 'unknown',
        updatedAtKST: item.updatedAtKST || item.createdAtKST || ''
      };
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'POST만 사용할 수 있어.' });
  }

  const {
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH = 'main',
    ADMIN_PIN
  } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return jsonResponse(500, {
      error: 'Netlify 환경변수 GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO가 필요해.'
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: '요청 JSON을 읽지 못했어.' });
  }

  try {
    assertAdminPin(event, payload, ADMIN_PIN);
  } catch (error) {
    return jsonResponse(error.statusCode || 401, {
      error: error.message || 'PIN 검증 실패'
    });
  }

  const target = getTarget(payload);
  const dataPath = getDataPath(target);
  const targetLabel = target === 'cashSnapshot' ? 'pension cash snapshot' : 'pension contribution';
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${dataPath}`;

  let current;
  let items;
  try {
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'investment-dashboard-netlify-function'
      }
    });

    const getData = await getRes.json().catch(() => ({}));

    if (getRes.status === 404 && target === 'cashSnapshot') {
      current = null;
      items = [];
    } else if (!getRes.ok) {
      return jsonResponse(getRes.status, { error: getData.message || 'GitHub 파일을 읽지 못했어.' });
    } else {
      current = getData;
      const doc = JSON.parse(decodeBase64(current.content || ''));
      items = target === 'cashSnapshot'
        ? normalizeArrayData(doc, 'snapshots')
        : normalizeArrayData(doc, 'contributions');
    }
  } catch (error) {
    return jsonResponse(500, { error: `GitHub 파일 읽기 실패: ${error.message}` });
  }

  items = normalizeItemsForTarget(items, target);

  const action = payload.action || 'upsert';
  let resultAction;
  let commitMessageDate;

  if (action === 'delete') {
  const beforeLength = items.length;

  if (target === 'cashSnapshot') {
    const date = String(payload.date || '').trim();

    if (!isValidDate(date)) {
      return jsonResponse(400, { error: '삭제할 date는 YYYY-MM-DD 형식이어야 해.' });
    }

    items = items.filter((v) => !(v && v.date === date));
    commitMessageDate = date;
  } else {
    const id = String(payload.id || '').trim();

    if (!id) {
      return jsonResponse(400, { error: '삭제할 기업적립금 id가 필요해.' });
    }

    const targetItem = items.find((v) => v && v.id === id);
    items = items.filter((v) => !(v && v.id === id));
    commitMessageDate = targetItem?.date || id;
  }

  if (items.length === beforeLength) {
    return jsonResponse(404, { error: '삭제할 항목을 찾지 못했어.' });
  }

  resultAction = 'deleted';
} else {
    const item = payload.item || {};
    const date = String(item.date || payload.date || '').trim();
    const memo = String(item.memo || payload.memo || '').trim();

    if (!isValidDate(date)) {
      return jsonResponse(400, { error: 'date는 YYYY-MM-DD 형식이어야 해.' });
    }

    let normalizedItem;

    if (target === 'cashSnapshot') {
      const valuation = Number(String(item.valuation ?? payload.valuation ?? item.amount ?? payload.amount ?? '').replace(/,/g, ''));

      if (!Number.isFinite(valuation) || valuation <= 0) {
        return jsonResponse(400, { error: 'valuation은 0보다 큰 숫자여야 해.' });
      }

      normalizedItem = {
        date,
        valuation: Math.round(valuation),
        memo: memo || '현금성자산 평가금액 앱 확인',
        updatedBy: item.updatedBy || payload.updatedBy || 'netlify',
        updatedAtKST: nowKST()
      };
    } else {
      const amount = Number(String(item.amount ?? payload.amount ?? '').replace(/,/g, ''));

      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonResponse(400, { error: 'amount는 0보다 큰 숫자여야 해. 삭제는 등록 내역에서 선택 항목 삭제를 사용해줘.' });
      }

      const id = String(item.id || payload.id || '').trim();

      normalizedItem = {
        id: id || newContributionId(date),
        date,
        amount: Math.round(amount),
        memo: memo || defaultContributionMemo(date),
        updatedBy: item.updatedBy || payload.updatedBy || 'netlify',
        updatedAtKST: nowKST()
      };
    }

    if (target === 'cashSnapshot') {
      const index = items.findIndex((v) => v && v.date === normalizedItem.date);

      if (index >= 0) {
        items[index] = normalizedItem;
        resultAction = 'updated';
      } else {
        items.push(normalizedItem);
        resultAction = 'created';
      }
    } else {
      const index = normalizedItem.id ? items.findIndex((v) => v && v.id === normalizedItem.id) : -1;

      if (index >= 0) {
        items[index] = normalizedItem;
        resultAction = 'updated';
      } else {
        items.push(normalizedItem);
        resultAction = 'created';
      }
    }

    commitMessageDate = normalizedItem.date;
  }

  items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id || '').localeCompare(String(b.id || '')));

  const content = `${JSON.stringify(items, null, 2)}\n`;

  let putData;
  try {
    const body = {
      message: `${resultAction === 'deleted' ? 'Delete' : resultAction === 'updated' ? 'Update' : 'Add'} ${targetLabel} ${commitMessageDate}`,
      content: encodeBase64(content),
      branch: GITHUB_BRANCH
    };

    if (current && current.sha) {
      body.sha = current.sha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'investment-dashboard-netlify-function'
      },
      body: JSON.stringify(body)
    });

    putData = await putRes.json().catch(() => ({}));

    if (!putRes.ok) {
      if (putRes.status === 409) {
        return jsonResponse(409, {
          error: '다른 저장이 먼저 반영되었습니다. 새로고침 후 다시 시도하세요.'
        });
      }

      return jsonResponse(putRes.status, { error: putData.message || 'GitHub 파일 저장 실패' });
    }
  } catch (error) {
    return jsonResponse(500, { error: `GitHub 파일 저장 실패: ${error.message}` });
  }

  return jsonResponse(200, {
    ok: true,
    target,
    action: resultAction,
    path: dataPath,
    commitSha: putData?.commit?.sha || null
  });
};
