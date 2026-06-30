const path = process.env.PENSION_DATA_PATH || 'data/pension_contributions.json';

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body)
});

const decodeBase64 = (content) => Buffer.from(content, 'base64').toString('utf8');
const encodeBase64 = (content) => Buffer.from(content, 'utf8').toString('base64');

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

  if (ADMIN_PIN && payload.pin !== ADMIN_PIN) {
    return jsonResponse(401, { error: '저장 PIN이 맞지 않아.' });
  }

  const action = payload.action || 'upsert';
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

  let current;
  try {
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'investment-dashboard-netlify-function'
      }
    });
    const getData = await getRes.json();
    if (!getRes.ok) {
      return jsonResponse(getRes.status, { error: getData.message || 'GitHub 파일을 읽지 못했어.' });
    }
    current = getData;
  } catch (error) {
    return jsonResponse(500, { error: `GitHub 파일 읽기 실패: ${error.message}` });
  }

  let doc;
  try {
    doc = JSON.parse(decodeBase64(current.content || ''));
  } catch (error) {
    return jsonResponse(500, { error: 'pension_contributions.json 파싱 실패.' });
  }

  if (!Array.isArray(doc.contributions)) doc.contributions = [];

  let resultAction;
  let commitMessageDate;

  if (action === 'delete') {
    const date = String(payload.date || '').trim();
    const source = String(payload.source || 'company').trim() || 'company';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonResponse(400, { error: '삭제할 date는 YYYY-MM-DD 형식이어야 해.' });
    }

    const beforeLength = doc.contributions.length;
    doc.contributions = doc.contributions.filter(
      (v) => !(v && v.date === date && (v.source || 'company') === source)
    );

    if (doc.contributions.length === beforeLength) {
      return jsonResponse(404, { error: '삭제할 항목을 찾지 못했어.' });
    }

    resultAction = 'deleted';
    commitMessageDate = date;
  } else {
    const item = payload.item || {};
    const date = String(item.date || '').trim();
    const amount = Number(item.amount);
    const memo = String(item.memo || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonResponse(400, { error: 'date는 YYYY-MM-DD 형식이어야 해.' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse(400, { error: 'amount는 0보다 큰 숫자여야 해. 삭제는 등록 내역에서 선택 항목 삭제를 사용해줘.' });
    }

    const normalizedItem = {
      date,
      source: item.source || 'company',
      amount,
      memo: memo || `${date.slice(0, 4)}년 ${Number(date.slice(5, 7))}월 기업적립금`
    };

    const index = doc.contributions.findIndex(
      (v) => v && v.date === normalizedItem.date && (v.source || 'company') === normalizedItem.source
    );

    if (index >= 0) {
      doc.contributions[index] = { ...doc.contributions[index], ...normalizedItem };
      resultAction = 'updated';
    } else {
      doc.contributions.push(normalizedItem);
      resultAction = 'created';
    }

    commitMessageDate = normalizedItem.date;
  }

  doc.contributions.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const content = `${JSON.stringify(doc, null, 2)}\n`;

  let putData;
  try {
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'investment-dashboard-netlify-function'
      },
      body: JSON.stringify({
        message: `${resultAction === 'deleted' ? 'Delete' : 'Update'} pension contribution ${commitMessageDate}`,
        content: encodeBase64(content),
        sha: current.sha,
        branch: GITHUB_BRANCH
      })
    });
    putData = await putRes.json();
    if (!putRes.ok) {
      return jsonResponse(putRes.status, { error: putData.message || 'GitHub 파일 저장 실패.' });
    }
  } catch (error) {
    return jsonResponse(500, { error: `GitHub 파일 저장 실패: ${error.message}` });
  }

  return jsonResponse(200, {
    ok: true,
    action: resultAction,
    path,
    commitSha: putData?.commit?.sha || null
  });
};
