const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'js/dashboard-heatmap.js'),'utf8');
let heatmap;

function moduleForNode(text){
  return text
    .replace(/import \{[^}]+\} from '\.\/dashboard-core\.js';/,"const dataState={activeDate:''}; const fmt=n=>Math.round(Number(n)||0).toLocaleString('ko-KR'); const won=n=>fmt(n)+'원'; const pct=n=>(Number(n)||0).toFixed(2)+'%'; const signed=(n,s='')=>(n>0?'+':'')+fmt(n)+s; const shortDate=value=>String(value);")
    .replace(/import \{[^}]+\} from '\.\/dashboard-ui-common\.js';/,"const assetPriceSourceInfo=()=>({source:'',state:'',observedAt:''}); const escapeHtml=value=>String(value); const navIconSvg=()=>'';")
    .replace(/import \{[\s\S]*?\} from '\.\/dashboard-modal\.js';/,"const bindDashboardModalDismiss=()=>{}; const closeDashboardModal=()=>{}; const openDashboardModal=()=>{};");
}

const approx=(actual,expected,tolerance=1e-8)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,`expected ${actual} ≈ ${expected}`);
};
const rectArea=rect=>rect.width*rect.height;
const overlapArea=(a,b)=>{
  const width=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
  const height=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  return width*height;
};

function canonicalFixture(){
  return {
    holdings:[
      {name:'삼성전자',ticker:'005930',type:'개별주식',qty:100,cost:7000000,avgPrice:70000,price:80000,evalAmount:8000000,profit:1000000,totalProfit:1200000,returnRate:16.2,priceSource:'json'},
      {name:'SK하이닉스',ticker:'000660',type:'개별주식',qty:10,cost:15000000,avgPrice:1500000,price:1700000,evalAmount:17000000,profit:2000000,totalProfit:2500000,returnRate:15.4,priceSource:'json'},
      {name:'제외0',ticker:'ZERO',qty:1,evalAmount:0,profit:0,returnRate:0},
      {name:'제외NaN',ticker:'NAN',qty:1,evalAmount:'not-a-number',profit:0,returnRate:0}
    ],
    securitiesAssetDetail:{change:{rows:[
      {name:'삼성전자',ticker:'005930',dayChange:240000,dayRate:3.1},
      {name:'SK하이닉스',ticker:'000660',dayChange:-170000,dayRate:-1.0}
    ]}}
  };
}

test.before(async()=>{
  const url='data:text/javascript;base64,'+Buffer.from(moduleForNode(source)).toString('base64');
  heatmap=await import(url);
});

test('히트맵 2차: canonical holdings/change rows를 합쳐 양수 평가금액 보유종목만 View Model로 만든다',()=>{
  const input=canonicalFixture();
  const before=structuredClone(input);
  const rows=heatmap.createPortfolioHeatmapViewModelFromCalc(input);
  assert.deepEqual(input,before,'원본 calc 결과를 mutate하면 안 된다');
  assert.deepEqual(rows.map(row=>row.ticker),['000660','005930']);
  assert.equal(rows[0].dayRate,-1);
  assert.equal(rows[0].dayChange,-170000);
  assert.equal(rows[0].dayUnitChange,-17000);
  assert.equal(rows[0].cumulativePnl,2500000);
  assert.equal(rows[0].cumulativeRate,15.4);
  assert.equal(rows[1].cumulativePnl,1200000);
  assert.equal(rows[1].dayUnitChange,2400);
  approx(rows.reduce((sum,row)=>sum+row.weight,0),100);
  approx(rows[0].weight,68);
  approx(rows[1].weight,32);
});

test('히트맵 2차: 동일 평가금액은 ticker/name stable tie-break로 결정한다',()=>{
  const rows=heatmap.createPortfolioHeatmapViewModel({holdings:[
    {ticker:'B',name:'둘',evalAmount:100},
    {ticker:'A',name:'하나',evalAmount:100},
    {ticker:'C',name:'셋',evalAmount:200}
  ]});
  assert.deepEqual(rows.map(row=>row.ticker),['C','A','B']);
});

test('히트맵 2차: 비정상 optional 숫자는 View Model 경계에서 null/0으로 정규화한다',()=>{
  const rows=heatmap.createPortfolioHeatmapViewModel({holdings:[{
    ticker:'A',name:'A',evalAmount:100,qty:Infinity,cost:undefined,avgPrice:'x',price:NaN,totalProfit:Infinity,profit:25,returnRate:'bad'
  }],changeRows:[{ticker:'A',dayChange:Infinity,dayRate:'bad'}]});
  assert.equal(rows.length,1);
  assert.equal(rows[0].qty,null);
  assert.equal(rows[0].cost,null);
  assert.equal(rows[0].avgPrice,null);
  assert.equal(rows[0].price,null);
  assert.equal(rows[0].dayChange,null);
  assert.equal(rows[0].dayRate,null);
  assert.equal(rows[0].cumulativePnl,25);
  assert.equal(rows[0].cumulativeRate,null);
  assert.equal(rows[0].weight,100);
  const missing=heatmap.createPortfolioHeatmapViewModel({holdings:[{ticker:'B',name:'B',evalAmount:50,returnRate:null}],changeRows:[{ticker:'B',dayRate:null}]});
  assert.equal(missing[0].dayRate,null,'데이터 없음은 0% 보합으로 바꾸면 안 된다');
  assert.equal(missing[0].cumulativeRate,null,'누적수익률 없음도 0%로 바꾸면 안 된다');
  assert.equal(missing[0].cumulativePnl,null,'누적손익 없음도 임의 0원으로 채우면 안 된다');
  const noCash=heatmap.createPortfolioHeatmapViewModel({holdings:[{ticker:'CASH',name:'현금',type:'현금',evalAmount:999},{ticker:'A',name:'A',type:'개별주식',evalAmount:1}]});
  assert.deepEqual(noCash.map(row=>row.ticker),['A'],'현금 row는 pure View Model 경계에서도 제외해야 한다');
});

test('히트맵 2차: treemap geometry는 동일 입력에서 deterministic하다',()=>{
  const rows=heatmap.createPortfolioHeatmapViewModelFromCalc(canonicalFixture());
  const first=heatmap.layoutPortfolioHeatmap(rows,1000,600);
  const second=heatmap.layoutPortfolioHeatmap(rows,1000,600);
  assert.deepEqual(first,second);
});

test('히트맵 2차: 모든 rect는 container 내부이며 overlap 없이 평가금액 면적비를 보존한다',()=>{
  const rows=heatmap.createPortfolioHeatmapViewModel({holdings:[
    {ticker:'A',name:'A',evalAmount:50},
    {ticker:'B',name:'B',evalAmount:30},
    {ticker:'C',name:'C',evalAmount:12},
    {ticker:'D',name:'D',evalAmount:8}
  ]});
  const width=800,height=500,laid=heatmap.layoutPortfolioHeatmap(rows,width,height);
  assert.equal(laid.length,4);
  laid.forEach(row=>{
    const {x,y,width:rw,height:rh}=row.rect;
    assert.ok(x>=-1e-8&&y>=-1e-8&&rw>=0&&rh>=0);
    assert.ok(x+rw<=width+1e-7&&y+rh<=height+1e-7);
    approx(rectArea(row.rect),width*height*(row.weight/100),1e-5);
  });
  for(let i=0;i<laid.length;i++)for(let j=i+1;j<laid.length;j++)approx(overlapArea(laid[i].rect,laid[j].rect),0,1e-7);
  approx(laid.reduce((sum,row)=>sum+rectArea(row.rect),0),width*height,1e-5);
});

test('히트맵 2차: 평가금액이 큰 종목은 더 큰 tile area를 가진다',()=>{
  const rows=heatmap.createPortfolioHeatmapViewModel({holdings:[
    {ticker:'BIG',evalAmount:700},
    {ticker:'MID',evalAmount:200},
    {ticker:'SMALL',evalAmount:100}
  ]});
  const laid=heatmap.layoutPortfolioHeatmap(rows,900,450);
  assert.ok(rectArea(laid[0].rect)>rectArea(laid[1].rect));
  assert.ok(rectArea(laid[1].rect)>rectArea(laid[2].rect));
});

test('히트맵 재설계 1차: mode metric은 모드별 면적 기준과 표시용 raw 값을 제공한다',()=>{
  const row={dayRate:1.25,dayChange:-4320000,dayUnitChange:-9000,cumulativeRate:18.4,cumulativePnl:-22100000,weight:24.8,evalAmount:142300000};
  assert.deepEqual(heatmap.portfolioHeatmapModeMetric(row,'day'),{
    mode:'day',primaryValue:1.25,secondaryValue:-4320000,tertiaryValue:-9000,areaValue:4320000,colorValue:1.25,colorKind:'performance'
  });
  assert.deepEqual(heatmap.portfolioHeatmapModeMetric(row,'cumulative'),{
    mode:'cumulative',primaryValue:18.4,secondaryValue:-22100000,tertiaryValue:null,areaValue:22100000,colorValue:18.4,colorKind:'performance'
  });
  assert.deepEqual(heatmap.portfolioHeatmapModeMetric(row,'weight'),{
    mode:'weight',primaryValue:24.8,secondaryValue:142300000,tertiaryValue:null,areaValue:142300000,colorValue:null,colorKind:'neutral'
  });
});

test('히트맵 재설계 1차: 전일 대비 면적은 dayChange 절댓값이며 0/null 종목은 geometry에서 제외한다',()=>{
  const rows=[
    {ticker:'POS',evalAmount:100,dayChange:100},
    {ticker:'NEG',evalAmount:1000,dayChange:-300},
    {ticker:'ZERO',evalAmount:5000,dayChange:0},
    {ticker:'NULL',evalAmount:9000,dayChange:null}
  ];
  assert.equal(heatmap.portfolioHeatmapAreaValue(rows[0],'day'),100);
  assert.equal(heatmap.portfolioHeatmapAreaValue(rows[1],'day'),300);
  const laid=heatmap.layoutPortfolioHeatmap(rows,800,400,'day');
  assert.deepEqual(laid.map(row=>row.ticker),['NEG','POS']);
  approx(rectArea(laid[0].rect)/rectArea(laid[1].rect),3,1e-8);
  approx(laid.reduce((sum,row)=>sum+rectArea(row.rect),0),800*400,1e-5);
});

test('히트맵 재설계 1차: 누적손익은 손익 절댓값, 비중은 평가금액으로 서로 다른 geometry를 만든다',()=>{
  const rows=[
    {ticker:'A',evalAmount:900,cumulativePnl:100},
    {ticker:'B',evalAmount:100,cumulativePnl:-400}
  ];
  const cumulative=heatmap.layoutPortfolioHeatmap(rows,1000,500,'cumulative');
  const weight=heatmap.layoutPortfolioHeatmap(rows,1000,500,'weight');
  assert.deepEqual(cumulative.map(row=>row.ticker),['B','A']);
  assert.deepEqual(weight.map(row=>row.ticker),['A','B']);
  approx(rectArea(cumulative[0].rect)/rectArea(cumulative[1].rect),4,1e-8);
  approx(rectArea(weight[0].rect)/rectArea(weight[1].rect),9,1e-8);
});

test('히트맵 재설계 1차: 모든 면적값이 0이면 빈 geometry로 안전 종료한다',()=>{
  const rows=[{ticker:'A',evalAmount:100,dayChange:0},{ticker:'B',evalAmount:200,dayChange:null}];
  assert.deepEqual(heatmap.layoutPortfolioHeatmap(rows,500,300,'day'),[]);
});

test('히트맵 2차: 잘못된 canvas 크기나 layout 불가 입력은 빈 결과로 안전 종료한다',()=>{
  const rows=heatmap.createPortfolioHeatmapViewModel({holdings:[{ticker:'A',evalAmount:100}]});
  assert.deepEqual(heatmap.layoutPortfolioHeatmap(rows,0,500),[]);
  assert.deepEqual(heatmap.layoutPortfolioHeatmap(rows,500,NaN),[]);
  assert.deepEqual(heatmap.layoutPortfolioHeatmap([],500,500),[]);
});

test('히트맵 3차: 당일 ±3% / 누적 ±30% 고정 scale은 방향과 intensity만 계산한다',()=>{
  assert.deepEqual(heatmap.portfolioHeatmapColorState({dayRate:1.5},'day'),{kind:'performance',direction:'positive',intensity:50,value:1.5});
  assert.deepEqual(heatmap.portfolioHeatmapColorState({dayRate:-4},'day'),{kind:'performance',direction:'negative',intensity:100,value:-4});
  assert.deepEqual(heatmap.portfolioHeatmapColorState({dayRate:0},'day'),{kind:'neutral',direction:'neutral',intensity:0,value:0});
  assert.deepEqual(heatmap.portfolioHeatmapColorState({dayRate:null},'day'),{kind:'unavailable',direction:'neutral',intensity:0,value:null});
  assert.deepEqual(heatmap.portfolioHeatmapColorState({cumulativeRate:15},'cumulative'),{kind:'performance',direction:'positive',intensity:50,value:15});
  assert.deepEqual(heatmap.portfolioHeatmapColorState({weight:25},'weight'),{kind:'neutral',direction:'weight',intensity:100,value:null});
});

test('히트맵 3차: tile 정보 밀도는 실제 rect px 크기로 Large/Medium/Small/Tiny를 판정한다',()=>{
  assert.equal(heatmap.portfolioHeatmapTileDensity({width:220,height:120}),'large');
  assert.equal(heatmap.portfolioHeatmapTileDensity({width:120,height:60}),'medium');
  assert.equal(heatmap.portfolioHeatmapTileDensity({width:60,height:32}),'small');
  assert.equal(heatmap.portfolioHeatmapTileDensity({width:30,height:20}),'tiny');
});

