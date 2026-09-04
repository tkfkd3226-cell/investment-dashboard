// Dashboard Responsive Contract · feature-neutral viewport predicates
// Ownership: CSS media values와 동기화되는 JS responsive query는 이 모듈이 단일 source로 소유한다.
// Feature modules는 query literal을 재정의하지 않고 이 contract를 가져다 쓴다.

const PHONE_PORTRAIT_QUERY='(max-width:760px)';
const PHONE_LANDSCAPE_QUERY='(orientation:landscape) and (max-width:960px) and (max-height:500px) and (hover:none) and (pointer:coarse)';
const PHONE_UI_QUERY=`${PHONE_PORTRAIT_QUERY}, ${PHONE_LANDSCAPE_QUERY}`;

function mediaMatches(query){
  return window.matchMedia?.(query).matches===true;
}
function phoneLandscapeUi(){
  return mediaMatches(PHONE_LANDSCAPE_QUERY);
}
function phoneUi(){
  return mediaMatches(PHONE_UI_QUERY);
}

export {
  PHONE_LANDSCAPE_QUERY,
  PHONE_PORTRAIT_QUERY,
  PHONE_UI_QUERY,
  phoneLandscapeUi,
  phoneUi
};
