const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ADD_DIR=path.resolve(__dirname,'../add');
const read=name=>fs.readFileSync(path.join(ADD_DIR,name),'utf8');
const css=read('add.css');
const js=read('add.js');
const calc=read('calc.html');
const report=read('kodex-leverage-report.html');

const compact=s=>s.replace(/\s+/g,' ');
const css1=compact(css);
const js1=compact(js);

const rule=selector=>{
  const i=css1.indexOf(selector);
  assert.notEqual(i,-1,`missing selector: ${selector}`);
  const open=css1.indexOf('{',i);
  const close=css1.indexOf('}',open);
  assert.ok(open>i&&close>open,`missing rule body: ${selector}`);
  return css1.slice(open+1,close);
};
const calcScope=()=>css1.slice(css1.indexOf('/* ==================== 02. Calc'),css1.indexOf('/* ==================== 03. Report'));

// 이 파일은 장기 UI/상태 contract만 보호한다.
// 장식용 exact px/hex/shadow/개수는 테스트하지 않고, 같은 의미가 하나의 source를 공유하는지와
// responsive/state/accessibility 경계가 유지되는지를 production HTML/CSS/JS에서 확인한다.

test('shared hover는 fine pointer에서만 동작하고 선택 상태를 덮지 않는다',()=>{
  assert.match(css1,/@media \(hover:hover\) and \(pointer:fine\)\{/);
  assert.match(css1,/:hover:not\(:disabled\):not\(\.active\):not\(\[aria-selected="true"\]\):not\(\[aria-pressed="true"\]\)/);
});

test('Calc/Report는 Main appearance 저장값과 BroadcastChannel을 함께 소비한다',()=>{
  assert.match(js1,/const THEME_KEY='investmentDashboard\.theme'/);
  assert.match(js1,/const CORNER_KEY='investmentDashboard\.cornerTheme'/);
  assert.match(js1,/const APPEARANCE_CHANNEL_NAME='investmentDashboard\.appearance'/);
  assert.match(js1,/syncStoredAppearance/);
  assert.match(js1,/window\.addEventListener\('storage'/);
  assert.match(js1,/new BroadcastChannel\(APPEARANCE_CHANNEL_NAME\)/);
  assert.match(js1,/appearanceChannel\.addEventListener\('message',syncStoredAppearance\)/);
  assert.match(js1,/const ADD_APPEARANCE_EVENT='investmentDashboard:appearancechange'/);
  assert.match(js1,/window\.dispatchEvent\(new CustomEvent\(ADD_APPEARANCE_EVENT\)\)/);
  assert.match(js1,/window\.addEventListener\(ADD_APPEARANCE_EVENT,\(\)=>requestAnimationFrame\(drawChart\)\)/);
  assert.match(js1,/pageshow|focus|visibilitychange/);
  assert.match(css1,/html\.rounded-corners\{/);
  const start=css1.indexOf(':root:where([data-add-page="calc"]){');
  const end=css1.indexOf('html:where([data-add-page="calc"]).dark{',start);
  const root=css1.slice(start,end);
  assert.doesNotMatch(root,/--(?:surface|control|inner)-radius-md:/);
});

test('Report 로딩 실패는 빈 리포트를 노출하지 않고 재시도할 수 있다',()=>{
  assert.match(js1,/document\.documentElement\.classList\.add\('report-data-error'\)/);
  assert.match(js1,/const retry=document\.createElement\('button'\);/);
  assert.match(js1,/retry\.textContent='다시 시도';/);
  assert.match(js1,/target\.replaceChildren\(message,retry\);/);
  assert.match(js1,/document\.documentElement\.classList\.remove\('report-data-error'\);/);
  assert.match(js1,/startReportPage\(\);/);
  assert.match(css1,/html:where\(\[data-add-page="report"\]\)\.report-data-error :is\(\.hero,\.report-nav,\.panel\)\{display:none\}/);
});

test('Calc 도움말은 공통 label 정렬을 유지하고 keyboard focus 표시도 Esc로 dismiss한다',()=>{
  const label=rule(':where(html[data-add-page="calc"]) :is(.label-with-help,.inline-help-label,.group-title-main)');
  assert.match(label,/display:inline-flex/);
  assert.match(label,/align-items:center/);
  const wrap=rule(':where(html[data-add-page="calc"]) .help-tooltip');
  assert.match(wrap,/display:inline-flex/);
  assert.match(wrap,/align-items:center/);
  assert.doesNotMatch(label,/top:|margin-top:|margin-bottom:/);
  assert.doesNotMatch(wrap,/top:|margin-top:|margin-bottom:/);
  assert.match(calc,/class="help-icon add-button"[^>]*aria-describedby=/);
  assert.match(js1,/class="help-icon add-button"[^>]*aria-describedby=/);
  assert.match(calc,/class="info-icon-svg"[^>]*><use href="\.\.\/img\/ui-icons\.svg#info-circle"><\/use><\/svg>/);
  assert.match(js1,/ADD_INFO_ICON_SVG='[^']*ui-icons\.svg#info-circle/);
  assert.doesNotMatch(calc,/aria-hidden="true">i<\/span>/);
  assert.doesNotMatch(js,/aria-hidden="true">i<\/span>/);
  const icon=rule(':where(html[data-add-page="calc"]) .help-icon');
  assert.match(icon,/border:0/);
  assert.match(rule(':where(html[data-add-page="calc"]) .help-icon .info-icon-svg'),/width:100%;height:100%/);
  assert.match(css,/--help-icon-active-color:/);
  assert.doesNotMatch(css,/--help-icon-active-border:/);
  assert.match(css1,/\.help-tooltip\.is-dismissed:focus-within \.custom-tooltip\{opacity:0;visibility:hidden;/);
  assert.match(js1,/const focusedWrap=document\.activeElement\?\.closest\?\.\('\.help-tooltip'\)\|\|null;/);
  assert.match(js1,/targets\.forEach\(w=>closeHelpTooltip\(w,\{dismissFocus:w===focusedWrap\}\)\)/);
});

test('거래유형 preset은 active와 aria-pressed를 같은 state owner에서 갱신한다',()=>{
  assert.match(js1,/function setPresetActive\(id\)\{[^}]*classList\.toggle\('active',active\);b\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(calc,/class="preset-btn[^"]*"[^>]*aria-pressed="(?:true|false)"/);
});

test('Calc 수동 편집은 거래유형 선택을 유지하고 presetDirty로 실제 매도단가 shortcut만 비활성화한다',()=>{
  const start=js1.indexOf('function markPresetDirty');
  assert.ok(start>=0,'missing markPresetDirty');
  const dirtyFn=js1.slice(start,start+220);
  assert.match(dirtyFn,/if\(applying\|\|presetDirty\)return;\s*presetDirty=true;\s*updateActualSellPriceUI\(\);/);
  assert.doesNotMatch(dirtyFn,/activePresetId\s*=|setPresetActive\(/);
  for(const handler of ['handleMoneyInput','handleNumberInput','handleShareStep','handlePctStep','handleModeChange']){
    const handlerStart=js1.indexOf(`function ${handler}`);
    assert.ok(handlerStart>=0,`missing ${handler}`);
    assert.ok(js1.slice(handlerStart,handlerStart+500).includes('markPresetDirty()'),`${handler} must mark preset dirty`);
  }
  assert.match(js1,/if\(noPriorMode\|\|presetDirty\|\|activePresetId!==getPresetIdForCurrentCase\(\)\)return null;/);
});

test('Calc 저장 복원은 presetId 선택과 presetDirty를 함께 보존하고 구버전·잘못된 presetId만 안전하게 추정한다',()=>{
  assert.match(js1,/const hasStoredPresetId=Object\.prototype\.hasOwnProperty\.call\(v,'presetId'\);/);
  assert.match(js1,/const storedPresetIsValid=hasStoredPresetId&&!!presets\[v\.presetId\];/);
  assert.match(js1,/activePresetId=storedPresetIsValid\s*\?v\.presetId\s*:\(v\.noPrior\?'current-only':\(v\.caseType==='holding'\?'buy-2026-07-29':'buy-2026-07-30'\)\);/);
  assert.match(js1,/presetDirty=Object\.prototype\.hasOwnProperty\.call\(v,'presetDirty'\)\s*\?!!v\.presetDirty\s*:\(hasStoredPresetId&&!storedPresetIsValid\);/);
  assert.match(js1,/setPresetActive\(activePresetId\);\s*applyValues\(v\);/);
});

test('Calc 검증 오류는 해당 control의 aria-invalid와 설명 영역을 함께 갱신한다',()=>{
  assert.match(js1,/\.control\[aria-invalid="true"\][^]*?setAttribute\('aria-invalid','false'\)/);
  assert.match(js1,/\.control\[aria-describedby="validationMessage"\][^]*?removeAttribute\('aria-describedby'\)[^]*?validation\.invalidIds/);
  assert.match(js1,/n\.setAttribute\('aria-invalid','true'\);n\.setAttribute\('aria-describedby','validationMessage'\);/);
});



test('Calc setText는 새 의미색이 없더라도 이전 positive/negative/zero를 항상 초기화한다',()=>{
  assert.match(js1,/const setText=\(id,text,cls=''\)=>\{[^}]*?n\.textContent=text;setClass\(n,cls\);\}/);
  assert.doesNotMatch(js1,/const setText=\(id,text,cls[^)]*\)=>\{[^}]*?if\(cls\)setClass\(n,cls\)/);
});

test('KODEX Report 손익 의미색과 수익 구성은 현재 파생값/상태에서 동적으로 결정한다',()=>{
  assert.match(js1,/const REPORT_SIGNED_METRIC_KEYS=new Set\(\['totalPnl','totalNet','corePnl','coreNet','dayPnl','dayNet'\]\)/);
  assert.match(js1,/node\.hasAttribute\('data-report-sign'\)&&REPORT_SIGNED_METRIC_KEYS\.has\(key\)/);
  assert.match(js1,/node\.classList\.remove\('pos','neg'\);[^}]*?reportValueClass\(value\)/);
  assert.match(js1,/function deriveProfitComposition\(coreNet,dayNet\)/);
  assert.match(js1,/const available=total>0&&core>=0&&day>=0/);
  assert.match(js1,/profitComposition\.available\?'available':'unavailable'/);
  assert.match(report,/data-report-sign/);
  for(const line of report.split('\n').filter(line=>line.includes('hero-chip')&&line.includes('data-report-value')))assert.doesNotMatch(line,/data-report-sign/,'Hero chip은 기존 중립/전용 색을 유지해야 한다');
  assert.match(report,/data-report-composition-value/);
  assert.match(report,/data-report-composition-label/);
  assert.match(report,/data-report-composition-note hidden/);
  assert.match(report,/data-report-composition-share="core"/);
  assert.match(report,/data-report-composition-share="day"/);
  assert.match(css1,/\.donut\[data-composition-state="unavailable"\]/);
  assert.match(css1,/\.report-sign-value\.pos\{color:var\(--positive\)\}/);
  assert.match(css1,/\.report-sign-value\.neg\{color:var\(--negative\)\}/);

  const signedKeys=['totalNet','totalPnl','coreNet','corePnl','dayNet','dayPnl'];
  for(const tag of report.match(/<(?:div|td|strong|b)[^>]*data-report-value="[^"]+"[^>]*>/g)||[]){
    const key=tag.match(/data-report-value="([^"]+)"/)?.[1];
    if(signedKeys.includes(key))assert.doesNotMatch(tag,/class="[^"]*pos/ ,`${key}에 양수 class를 HTML 고정하면 안 된다`);
  }
});

test('Calc 이미 회복 상태는 0원·-100% 대신 현재 종가와 상태 문구를 사용한다',()=>{
  assert.match(js1,/const integratedRecoverySatisfied=settled&&!noPrior&&finalCost>0&&priorPL>=finalCost;/);
  assert.match(js1,/integratedRecoverySatisfied\?ceil5\(input\.currentPrice\):integratedBEOrder/);
  assert.match(js1,/priorPL>=principal\)return ceil5\(Number\(v\.currentPrice\)\|\|0\);/);
  assert.match(js1,/c\.integratedRecoverySatisfied\?'이미 회복':nf0\.format\(c\.settled\?c\.integratedBE:c\.positionBE\)/);
  assert.match(js1,/setText\('kpi3Value',c\.integratedRecoverySatisfied\?'이미 회복':won\(c\.integratedBEOrder\)/);
  assert.match(js1,/if\(c\.integratedRecoverySatisfied\)\{setText\('range2Value','이미 회복','positive'\)/);
  assert.doesNotMatch(js1,/const ceil5=n=>Math\.ceil\(\(n-1e-9\)\/5\)\*5/);
});

test('Calc는 실제 거래일별 빠른 매수 shortcut을 누적하지 않는다',()=>{
  for(const source of [calc,js1,css1]) assert.doesNotMatch(source,/current-purchase-preset|current-purchase-btn|applyBuy20260804|applyBuy20260806|purchase-preset|current-column/);
  const noPrior=rule(':where(html[data-add-page="calc"]) .input-grid.no-prior-layout');
  assert.match(noPrior,/grid-template-areas:"current-group calculation-group"/);
});

test('터치 스마트폰 가로는 Tablet이 아니라 Phone UI contract를 사용한다',()=>{
  const media=/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{/;
  assert.match(css1,media);
  assert.match(css1,/:where\(html\[data-add-page="calc"\]\) \.input-grid:not\(\.no-prior-layout\), :where\(html\[data-add-page="calc"\]\) \.input-grid\.no-prior-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css1,/#reportBtn \.report-text[^}]*display:none/);
});

test('Calc와 Report의 손익 의미색은 공통 semantic state를 사용한다',()=>{
  assert.match(rule(':where(html[data-add-page="calc"]) .positive, :where(html[data-add-page="report"]) .pos, :where(html[data-add-page="report"]) .timeline-profit-card.pos strong'),/color:var\(--positive\)/);
  assert.match(rule(':where(html[data-add-page="calc"]) .negative, :where(html[data-add-page="report"]) .neg, :where(html[data-add-page="report"]) .timeline-profit-card.neg strong'),/color:var\(--negative\)/);
});

test('동적 결과 도움말은 공통 label helper와 aria-describedby 연결을 사용한다',()=>{
  assert.match(js1,/const resultLabel=/);
  assert.match(js1,/resultLabelHTML/);
  assert.match(js1,/aria-describedby="\$\{tooltipId\}"/);
});

test('Calc strategy tab은 visual state와 ARIA/tabindex/panel state를 함께 갱신한다',()=>{
  assert.match(js1,/classList\.toggle\('active',active\).*aria-selected.*tabIndex=active\?0:-1/);
  assert.match(js1,/panel\.classList\.toggle\('active',active\);panel\.setAttribute\('aria-hidden',String\(!active\)\)/);
  assert.match(calc,/role="tablist"/);
});

test('Report tab은 하나의 tablist에서 active/ARIA/tabindex state를 유지한다',()=>{
  assert.match(js1,/btn\.classList\.toggle\('active', active\).*aria-selected.*btn\.tabIndex = active \? 0 : -1/);
  assert.match(report,/role="tablist"/);
});

test('invalid 입력은 마지막 정상 결과를 stale 상태로 표시하고 정상화 시 해제한다',()=>{
  assert.match(js1,/let hasRenderedCalculation=false/);
  assert.match(js1,/setCalculationResultsStale\(hasRenderedCalculation\)/);
  assert.match(js1,/setCalculationResultsStale\(false\)/);
  assert.match(js1,/hasRenderedCalculation=true/);
  assert.match(js,/아래 결과는 마지막 정상 입력 기준입니다/);
  assert.match(css1,/\.calc-results-stale :is\(\.calc-summary-panel,#strategyTabs,main\)/);
});

test('Report Timeline 실현손익 카드는 canonical net에서 파생되고 Phone에서 세로 배치된다',()=>{
  assert.match(js1,/net:reportSum\(rows,'net'\)/);
  assert.match(js1,/function timelineProfitCard\(net\)/);
  assert.match(js1,/reportMetricText\(net,'signedWon'\)/);
  assert.match(css1,/:where\(html\[data-add-page="report"\]\) \.timeline-card\{display:grid/);
  assert.match(css1,/@media \(max-width:760px\), \(orientation:landscape\) and \(max-width:960px\) and \(max-height:500px\) and \(hover:none\) and \(pointer:coarse\)\{[^]*?\.timeline-card\{grid-column:2;grid-template-columns:minmax\(0,1fr\)/);
});

test('interaction state는 입력 방식과 ARIA 상태별 owner를 유지한다',()=>{
  assert.match(css1,/\.preset-btn:is\(\.active,\[aria-pressed="true"\]\)/);
  assert.match(css1,/\.report-nav \.tab:is\(\.active,\[aria-selected="true"\]\)/);
  assert.match(css1,/\.help-icon:focus-visible, :where\(html\[data-add-page="calc"\]\) \.help-tooltip\.is-open \.help-icon/);
  assert.match(css1,/@media \(hover:hover\) and \(pointer:fine\)\{[^]*?\.help-icon:hover/);
});

test('Calc Desktop 결과표는 화면 제목과 같은 hidden caption으로 접근 가능한 이름을 가진다',()=>{
  assert.match(css1,/:where\(html\[data-add-page="calc"\],html\[data-add-page="report"\]\) \.sr-only\{/);
  assert.match(js1,/function desktopTable\(caption,headers,vals,idPrefix='table'\)\{[^]*?<caption class="sr-only">\$\{esc\(caption\)\}<\/caption>/);
  assert.match(js1,/desktopTable\('매도 결과',saleH,saleV,/);
  assert.match(js1,/desktopTable\('원금 회수 결과',flowH,flowV,/);
  assert.match(js1,/desktopTable\(integrationTitle,integratedH,integratedV,/);
});

test('Calc와 Report HTML은 add.css + add.js 단일 canonical runtime만 사용한다',()=>{
  for(const html of [calc,report]){
    assert.match(html,/href="add\.css"/);
    assert.match(html,/src="add\.js"/);
    assert.doesNotMatch(html,/add-theme\.(?:css|js)|(?:calc|report)-alt\.css|data-add-theme|id="addThemeToggle"/);
  }
  for(const name of ['add-theme.css','add-theme.js','calc-alt.css','report-alt.css']) assert.equal(fs.existsSync(path.join(ADD_DIR,name)),false,`${name} must be removed`);
});

test('Report 표는 caption/header semantic을 유지한다',()=>{
  assert.match(report,/<caption class="sr-only">/);
  assert.match(report,/<th scope="col">/);
  assert.match(report,/<th scope="row">합계<\/th>/);
});


test('Report Hero/KPI responsive 의미배치는 semantic role class를 사용하고 DOM 순번에 의존하지 않는다',()=>{
  for(const role of ['hero-chip-core','hero-chip-day','hero-chip-total','report-kpi-total-net','report-kpi-total-pnl','report-kpi-total-fee','report-kpi-core-net','report-kpi-day-net','report-kpi-win-rate']){
    assert.match(report,new RegExp(`\\b${role}\\b`));
  }
  assert.match(css1,/\.hero-chip-total\{grid-column:1 \/ -1\}/);
  assert.match(css1,/#summary \.report-kpi-core-net\{order:3\}/);
  assert.match(css1,/#summary \.report-kpi-total-net \.sub\{white-space:nowrap/);
  assert.doesNotMatch(css1,/\.hero-summary > \.hero-chip:nth-child\([123]\)/);
  assert.doesNotMatch(css1,/#summary \.kpi:nth-child\(/);
});

test('Report Phone split total은 숨긴 desktop stats에 dead layout declaration을 남기지 않는다',()=>{
  const phoneStart=css1.indexOf('@media (max-width:760px), (orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse){',css1.indexOf('/* ==================== 03. Report'));
  assert.notEqual(phoneStart,-1);
  const phone=css1.slice(phoneStart);
  assert.match(phone,/\.split-total-stats\{display:none\}/);
  assert.doesNotMatch(phone,/\.split-total-stats\{display:none;[^}]*?(?:justify-content|gap):/);
});

test('Report chart 손익색은 Add 공통 semantic value source를 alias하고 Calc mobile icon은 Phone Shared만 소유한다',()=>{
  assert.match(css1,/--chart-positive:var\(--positive\)/);
  assert.match(css1,/--chart-negative:var\(--negative\)/);
  assert.doesNotMatch(css1,/--chart-positive:#(?:EF3341|FF5964)/i);
  assert.doesNotMatch(css1,/--chart-negative:#(?:3182F6|60A5FA)/i);
  assert.equal((css.match(/:where\(html\[data-add-page="calc"\]\) \.add-button-mobile-icon\{/g)||[]).length,1);
  assert.doesNotMatch(css1,/@media\(max-width:760px\)\{ \.add-button-mobile-icon\{/);
});

test('Report boot는 canonical data를 검증해 렌더하고 실패 UI를 제공한다',()=>{
  assert.match(js,/const REPORT_DATA_URL='\.\.\/data\/kodex_leverage_trades\.json'/);
  assert.match(js,/const REPORT_SCHEMA_MODULE_URL='\.\.\/js\/kodex-leverage-schema\.js'/);
  assert.match(js,/async function loadReportSource\(\)/);
  assert.match(js,/schema\.validateKodexLeverageSource\(source\)/,'Report는 canonical source를 공통 schema로 검증해야 한다');
  assert.match(js,/deriveReportModel\(source\)/,'검증한 canonical source에서 화면 모델을 파생해야 한다');
  assert.match(report,/data-report-load-error[^>]*role=\"alert\"[^>]*hidden/,'데이터 로딩 실패는 접근 가능한 오류 UI를 제공해야 한다');
  assert.match(css1,/\.report-load-error\{/);
});

