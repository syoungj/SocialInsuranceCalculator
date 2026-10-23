// 2026년 보험료율 (고용보험은 2025년 요율)
const RATES = {
    pension: 0.095,             // 국민연금 9.5% (근로자·사업주 각 4.75%)
    health: 0.0719,             // 건강보험 7.19% (근로자·사업주 각 3.595%)
    longterm: 0.1314,           // 장기요양보험 — 건강보험료의 13.14%
    employmentWorker: 0.009,    // 고용보험 실업급여분 (근로자·사업주 동일 0.9%, 65세 이상은 제외)
    // 고용안정·직업능력개발사업분: 사업주만 내고, 나이와 무관하게 계속 부과됨 (150인 미만 기업 기준 0.25%)
    // 기업 규모별로 요율이 다르므로(150인 이상은 더 높음), 여기선 가장 흔한 소규모 사업장 기준 값을 씀
    employmentStability: 0.0025,
};

// 두루누리 사회보험료 지원 상한액 (2026년 기준)
const DURUNURI_CAPS = {
    pension: 87400,
    employmentWorker: 16560,
};

// 금액 입력칸("1,600,000")을 숫자로 — 쉼표 등 숫자 아닌 글자는 무시
function parseMoney(text) {
    return parseInt(String(text).replace(/[^0-9]/g, ''), 10);
}

// 금액 입력칸에 입력하는 동안 3자리마다 쉼표를 찍음. 쉼표가 생기거나 없어져도
// 커서가 엉뚱한 곳으로 튀지 않도록, 커서 앞 숫자 개수를 기준으로 위치를 되돌림
document.addEventListener('input', e => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('money-input')) return;

    const caret = el.selectionStart ?? el.value.length;
    const digitsBeforeCaret = el.value.slice(0, caret).replace(/[^0-9]/g, '').length;
    const digits = el.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
    const formatted = digits ? formatNumber(digits) : '';
    if (formatted === el.value) return;

    el.value = formatted;
    let pos = 0;
    for (let seen = 0; pos < formatted.length && seen < digitsBeforeCaret; pos++) {
        if (/\d/.test(formatted[pos])) seen++;
    }
    el.setSelectionRange(pos, pos);
});

// 10원 미만 절사. 0.009 같은 요율은 컴퓨터가 정확히 저장하지 못해 3,000,000×0.009가
// 26,999.999…로 계산되므로, 그냥 내림하면 27,000이 아니라 26,990이 됨 — 아주 작은 값을 더해 보정
function floor10(x) {
    return Math.floor(x / 10 + 1e-9) * 10;
}

// 2024년 산재보험료율표 (업종별, 천분율 → rate는 /1000 값)
// 실제로는 근로복지공단이 사업 내용을 보고 업종을 판단하므로, 이 선택은 참고용 추정치임
const INDUSTRY_RATES = [
    { name: '기타의 각종사업(음식업, 마트 등)', permille: 8 },
    { name: '건설업', permille: 35 },
    { name: '전문·보건·교육·여가관련 서비스업', permille: 6 },
    { name: '도소매·음식·숙박업', permille: 8 },
    { name: '부동산업 및 임대업', permille: 7 },
    { name: '국가 및 지방자치단체의 행정', permille: 9 },
    { name: '금융 및 보험업', permille: 5 },
    { name: '시설관리 및 사업지원 서비스업', permille: 8 },
    { name: '식료품제조업', permille: 16 },
    { name: '섬유 또는 섬유제품 제조업', permille: 11 },
    { name: '목재 및 종이제품 제조업', permille: 20 },
    { name: '출판, 인쇄, 제본 또는 인쇄물가공업', permille: 9 },
    { name: '화학 및 고무제품 제조업', permille: 13 },
    { name: '의약품·화장품·연탄·석유제품 제조업', permille: 7 },
    { name: '기계기구·금속·비금속광물제품제조업', permille: 13 },
    { name: '금속제련업', permille: 10 },
    { name: '전기기계기구·정밀기구·전자제품 제조업', permille: 6 },
    { name: '선박건조 및 수리업', permille: 24 },
    { name: '수제품 및 기타제품 제조업', permille: 12 },
    { name: '철도·항공·창고·운수관련서비스업', permille: 8 },
    { name: '육상 및 수상운수업', permille: 18 },
    { name: '통신업', permille: 9 },
    { name: '전기, 가스, 증기 및 수도사업', permille: 7 },
    { name: '석탄광업 및 채석업', permille: 185 },
    { name: '석회석, 금속, 비금속광업 및 기타광업', permille: 57 },
    { name: '임업', permille: 58 },
    { name: '어업', permille: 27 },
    { name: '농업', permille: 20 },
];

// ========================================
// 외국인 근로자 — 국민연금·고용보험 적용 판단용 자료
// ========================================

// pensionExcluded: 체류자격별 국민연금 당연적용 제외 여부 (2024.4.1. 기준) — 국적보다 먼저 걸러짐
// employment: 체류자격별 고용보험 적용 (2026.10. 기준)
//   full = 당연 적용, reciprocal = 상호주의 충족 시 당연 적용, partial = 고용안정·직능만 당연(실업급여는 신청 시),
//   optional = 근로자 신청 시 전부 적용, excluded = 적용 제외
const VISA_TYPES = [
    { code: 'A-1', name: '외교', pensionExcluded: true, employment: 'excluded' },
    { code: 'A-2', name: '공무', pensionExcluded: true, employment: 'excluded' },
    { code: 'A-3', name: '협정', pensionExcluded: true, employment: 'excluded' },
    { code: 'B-1', name: '사증면제', pensionExcluded: true, employment: 'excluded' },
    { code: 'B-2', name: '관광통과', pensionExcluded: true, employment: 'excluded' },
    { code: 'C-1', name: '일시취재', pensionExcluded: true, employment: 'excluded' },
    { code: 'C-3', name: '단기방문', pensionExcluded: true, employment: 'excluded' },
    { code: 'C-4', name: '단기취업', pensionExcluded: true, employment: 'optional' },
    { code: 'D-1', name: '문화예술', pensionExcluded: true, employment: 'excluded' },
    { code: 'D-2', name: '유학', pensionExcluded: true, employment: 'excluded' },
    { code: 'D-3', name: '기술연수', pensionExcluded: true, employment: 'excluded' },
    { code: 'D-4', name: '일반연수', pensionExcluded: true, employment: 'excluded' },
    { code: 'D-5', name: '취재', pensionExcluded: false, employment: 'excluded' },
    { code: 'D-6', name: '종교', pensionExcluded: true, employment: 'excluded' },
    { code: 'D-7', name: '주재', pensionExcluded: false, employment: 'reciprocal' },
    { code: 'D-8', name: '기업투자', pensionExcluded: false, employment: 'reciprocal' },
    { code: 'D-9', name: '무역경영', pensionExcluded: false, employment: 'reciprocal' },
    { code: 'D-10', name: '구직', pensionExcluded: false, employment: 'excluded' },
    { code: 'E-1', name: '교수', pensionExcluded: false, employment: 'optional' },
    { code: 'E-2', name: '회화', pensionExcluded: false, employment: 'optional' },
    { code: 'E-3', name: '연구', pensionExcluded: false, employment: 'optional' },
    { code: 'E-4', name: '기술지도', pensionExcluded: false, employment: 'optional' },
    { code: 'E-5', name: '전문직업', pensionExcluded: false, employment: 'optional' },
    { code: 'E-6', name: '예술흥행', pensionExcluded: false, employment: 'optional' },
    { code: 'E-7', name: '특정활동', pensionExcluded: false, employment: 'optional' },
    { code: 'E-8', name: '계절근로', pensionExcluded: false, employment: 'optional' },
    { code: 'E-9', name: '비전문취업', pensionExcluded: false, employment: 'partial' },
    { code: 'E-10', name: '선원취업', pensionExcluded: false, employment: 'optional' },
    { code: 'F-1', name: '방문동거', pensionExcluded: true, employment: 'excluded' },
    { code: 'F-2', name: '거주', pensionExcluded: false, employment: 'full' },
    { code: 'F-3', name: '동반', pensionExcluded: true, employment: 'excluded' },
    { code: 'F-4', name: '재외동포', pensionExcluded: false, employment: 'optional' },
    { code: 'F-5', name: '영주', pensionExcluded: false, employment: 'full' },
    { code: 'F-6', name: '결혼이민', pensionExcluded: false, employment: 'full' },
    { code: 'G-1', name: '기타', pensionExcluded: true, employment: 'excluded' },
    { code: 'H-1', name: '관광취업', pensionExcluded: false, employment: 'excluded' },
    { code: 'H-2', name: '방문취업', pensionExcluded: false, employment: 'partial' },
];

// 국가별 국민연금 적용 여부 (2026.3.19. 기준, 136개국).
// 이 계산기는 "고용된 근로자(사업장가입자)"만 다루므로, 사업장 기준으로 판단이 갈리는 세 그룹 중
// "사업장·지역 적용제외국"(20개국)만 실제로 국민연금이 제외되고, 나머지(사업장은 당연적용인 116개국 +
// 표에 없는 국가)는 전부 가입 대상 — exempt: true인 나라만 제외 대상.
const PENSION_COUNTRIES = [
    { name: '가나', exempt: false }, { name: '가봉', exempt: false }, { name: '가이아나', exempt: false },
    { name: '그레나다', exempt: false }, { name: '그리스', exempt: false }, { name: '나이지리아', exempt: true },
    { name: '남아프리카공화국', exempt: true },
    { name: '네덜란드', exempt: false }, { name: '네팔', exempt: true }, { name: '노르웨이', exempt: false },
    { name: '뉴질랜드', exempt: false }, { name: '도미니카(연방)', exempt: false }, { name: '독일', exempt: false },
    { name: '덴마크', exempt: false }, { name: '동티모르(티모르민주공화국)', exempt: true }, { name: '라오스', exempt: false },
    { name: '라트비아', exempt: false }, { name: '러시아', exempt: false }, { name: '레바논', exempt: false },
    { name: '루마니아', exempt: false }, { name: '룩셈부르크', exempt: false }, { name: '리비아', exempt: false },
    { name: '리투아니아', exempt: false }, { name: '리히텐슈타인', exempt: false }, { name: '말레이시아', exempt: false },
    { name: '멕시코', exempt: false }, { name: '모나코', exempt: false }, { name: '모로코', exempt: false },
    { name: '모리셔스', exempt: false }, { name: '몬테네그로', exempt: false }, { name: '몰도바', exempt: false },
    { name: '몰디브', exempt: true }, { name: '몰타', exempt: false }, { name: '몽골', exempt: false },
    { name: '미국', exempt: false }, { name: '미얀마', exempt: true }, { name: '바누아투', exempt: false },
    { name: '바베이도스', exempt: false }, { name: '바하마', exempt: false }, { name: '방글라데시', exempt: true },
    { name: '버뮤다', exempt: false }, { name: '베네수엘라', exempt: false }, { name: '베트남', exempt: false },
    { name: '벨기에', exempt: false }, { name: '벨라루스', exempt: true }, { name: '벨리즈', exempt: false },
    { name: '볼리비아', exempt: false }, { name: '부룬디', exempt: false }, { name: '부탄', exempt: false },
    { name: '북마케도니아', exempt: false }, { name: '불가리아', exempt: false }, { name: '브라질', exempt: false },
    { name: '브루나이', exempt: true }, { name: '사우디아라비아', exempt: true }, { name: '세르비아', exempt: false },
    { name: '세인트빈센트그레나딘', exempt: false }, { name: '솔로몬군도', exempt: false }, { name: '수단', exempt: false },
    { name: '수리남', exempt: false }, { name: '스리랑카', exempt: false }, { name: '스와질란드(에스와티니)', exempt: true },
    { name: '스웨덴', exempt: false }, { name: '스위스', exempt: false }, { name: '스페인', exempt: false },
    { name: '슬로바키아', exempt: false }, { name: '슬로베니아', exempt: false }, { name: '시에라리온', exempt: false },
    { name: '싱가포르', exempt: true }, { name: '아르메니아', exempt: true }, { name: '아르헨티나', exempt: false },
    { name: '아제르바이잔', exempt: false },
    { name: '아이슬란드', exempt: false }, { name: '아이티', exempt: false }, { name: '아일랜드', exempt: false },
    { name: '알바니아', exempt: false }, { name: '알제리', exempt: false }, { name: '에콰도르', exempt: false },
    { name: '에스토니아', exempt: false }, { name: '에티오피아', exempt: true }, { name: '엘살바도르', exempt: false },
    { name: '영국', exempt: false }, { name: '예멘', exempt: false }, { name: '오스트리아', exempt: false },
    { name: '오스트레일리아(호주)', exempt: false }, { name: '요르단', exempt: false }, { name: '우간다', exempt: false },
    { name: '우루과이', exempt: false }, { name: '우즈베키스탄', exempt: false }, { name: '우크라이나', exempt: false },
    { name: '이란', exempt: true }, { name: '이스라엘', exempt: false }, { name: '이집트', exempt: false },
    { name: '이탈리아', exempt: false }, { name: '인도', exempt: false }, { name: '인도네시아', exempt: false },
    { name: '일본', exempt: false }, { name: '자메이카', exempt: false }, { name: '조지아', exempt: true },
    { name: '중국', exempt: false }, { name: '짐바브웨', exempt: false }, { name: '체코', exempt: false },
    { name: '칠레', exempt: false }, { name: '카메룬', exempt: false }, { name: '카보베르데', exempt: false },
    { name: '카자흐스탄', exempt: true },
    { name: '캄보디아', exempt: false }, { name: '캐나다', exempt: false }, { name: '케냐', exempt: false },
    { name: '코스타리카', exempt: false }, { name: '코트디부아르', exempt: false }, { name: '콜롬비아', exempt: false },
    { name: '콩고', exempt: false }, { name: '크로아티아', exempt: false }, { name: '키르기스스탄', exempt: false },
    { name: '키프로스', exempt: false }, { name: '타이(태국)', exempt: false }, { name: '타이완(대만)', exempt: false },
    { name: '탄자니아', exempt: false }, { name: '토고', exempt: false }, { name: '통가', exempt: true },
    { name: '튀니지', exempt: false }, { name: '튀르키예(터키)', exempt: false }, { name: '트리니다드토바고', exempt: false },
    { name: '파나마', exempt: false }, { name: '파라과이', exempt: false }, { name: '파키스탄', exempt: true },
    { name: '팔라우', exempt: false }, { name: '페루', exempt: false }, { name: '포르투갈', exempt: false },
    { name: '폴란드', exempt: false }, { name: '프랑스', exempt: false }, { name: '피지', exempt: true },
    { name: '핀란드', exempt: false }, { name: '필리핀', exempt: false }, { name: '헝가리', exempt: false },
    { name: '홍콩', exempt: false },
];

// 전역 상태
let salary = 0;
let birthDate = null;
let calc = {};                    // 근로자(단일) 계산 결과 (두루누리 토글 시 재사용)
let durunuriApplied = false;
let employerWorkersCalc = [];     // 사업주 경로 — 근로자별 계산 결과 목록 (PDF 저장 시 재사용)
let employerIndustryIdx = '';     // 사업주 경로 — 마지막으로 계산한 업종
let mwDurunuriApplied = { deduction: {}, burden: {} };  // 근로자 여러명 결과 — 근로자별 두루누리 토글 상태 (사업주 본인은 두루누리 대상이 아니라서 해당 없음)
let ownerCalc = null;              // 사업주 경로 — 체크박스로 선택했을 때만 채워지는 "사업주 본인" 계산 결과
let totalBillWorkersCalc = [];    // 전문가용 "한 달 총 부과 금액" — 근로자별 계산 결과 (PDF 저장 시 재사용)
let totalBillOwnerCalc = null;    // 전문가용 "한 달 총 부과 금액" — 사업주 본인 계산 결과
let totalBillIndustryIdx = '';    // 전문가용 "한 달 총 부과 금액" — 마지막으로 계산한 업종

function showStep(id) {
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // 상단 막대의 오른쪽 버튼(첫 화면은 "상담", 그 외에는 "이전")을 CSS에서 바꿀 수 있게 지금 화면을 표시
    document.body.dataset.step = id;
    window.scrollTo(0, 0);
}

// 선택 화면에서 근로자/사업주를 고르면 각자의 화면으로 전환
function goToWorkerStep() {
    showStep('stepWorker');
}

function goToEmployerStep() {
    initMultiWorkerRows();
    showStep('stepEmployer');
}

// 사업주 결과 화면 진입 시 하위 탭(근로자 공제분 / 사업주 부담분) 상태 초기화 (다 접힌 상태로)
function resetEmployerSubTabs() {
    document.getElementById('deductionExpand').classList.remove('open');
    document.getElementById('burdenExpand').classList.remove('open');
    document.getElementById('deductionOptionBtn').classList.remove('active');
    document.getElementById('burdenOptionBtn').classList.remove('active');
}

// 사업주 결과의 하위 탭(근로자 공제분 / 사업주 부담분) 펼치기/접기 — 선택 화면의 눌러서 펼치는 방식과 동일
function toggleEmployerSubTab(which) {
    const deductionExpand = document.getElementById('deductionExpand');
    const burdenExpand = document.getElementById('burdenExpand');
    const deductionBtn = document.getElementById('deductionOptionBtn');
    const burdenBtn = document.getElementById('burdenOptionBtn');

    if (which === 'deduction') {
        if (deductionExpand.classList.contains('open')) {
            deductionExpand.classList.remove('open');
            deductionBtn.classList.remove('active');
            return;
        }
        deductionExpand.classList.add('open');
        deductionBtn.classList.add('active');
        burdenExpand.classList.remove('open');
        burdenBtn.classList.remove('active');
    } else {
        if (burdenExpand.classList.contains('open')) {
            burdenExpand.classList.remove('open');
            burdenBtn.classList.remove('active');
            return;
        }
        burdenExpand.classList.add('open');
        burdenBtn.classList.add('active');
        deductionExpand.classList.remove('open');
        deductionBtn.classList.remove('active');
    }
}

// "199001" 6자리 문자열을 {year, month}로 변환 (형식이 이상하면 null)
function parseBirthdate(raw) {
    if (!/^\d{6}$/.test(raw)) return null;
    const year = parseInt(raw.slice(0, 4), 10);
    const month = parseInt(raw.slice(4, 6), 10);
    const thisYear = new Date().getFullYear();
    if (year < 1900 || year > thisYear) return null;
    if (month < 1 || month > 12) return null;
    return { year, month };
}

// {year, month}에서 개월 수를 더한(뺀) {year, month} 계산 (년 경계 자동 처리)
function addMonths(year, month, delta) {
    const totalMonths = year * 12 + (month - 1) + delta;
    return { year: Math.floor(totalMonths / 12), month: (totalMonths % 12) + 1 };
}

// {year, month} 두 값 비교: a가 b보다 이르면 -1, 같으면 0, 늦으면 1
function compareYearMonth(a, b) {
    if (a.year !== b.year) return a.year < b.year ? -1 : 1;
    if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    return 0;
}

// 만 60세(국민연금)·65세(고용보험 실업급여) 도달로 인한 제외 여부 계산
// (생일이 속한 달의 다음 달부터 제외 시작 — 생일이 속한 달까지는 그대로 부과됨)
// 근로자·사업주·여러명 계산 전부 같은 생년월 기준으로 공통 사용 (bd 생략 시 전역 birthDate 사용)
function calculateExemptions(bd = birthDate) {
    const now = new Date();
    const currentYM = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const nextYM = addMonths(currentYM.year, currentYM.month, 1);

    const pensionExemptStart = addMonths(bd.year + 60, bd.month, 1);
    const employmentExemptStart = addMonths(bd.year + 65, bd.month, 1);

    const pensionExempt = compareYearMonth(currentYM, pensionExemptStart) >= 0;
    const employmentExempt = compareYearMonth(currentYM, employmentExemptStart) >= 0;

    // 아직은 부과되지만 다음 달부터 제외되는 경우 미리 안내
    const pensionExemptNextMonth = !pensionExempt && compareYearMonth(nextYM, pensionExemptStart) >= 0;
    const employmentExemptNextMonth = !employmentExempt && compareYearMonth(nextYM, employmentExemptStart) >= 0;

    return { pensionExempt, employmentExempt, pensionExemptNextMonth, employmentExemptNextMonth };
}

// 근로자 본인 부담금 계산 (급여·생년월을 받아 계산) — 근로자(단일) 계산과 사업주 경로의 "공제" 탭이 공용으로 사용
// (60세 되는 달의 다음 달부터 국민연금 제외, 65세 되는 달의 다음 달부터 고용보험 실업급여 제외)
function computeWorkerShare(workerSalary, workerBirthDate) {
    const { pensionExempt, employmentExempt, pensionExemptNextMonth, employmentExemptNextMonth } = calculateExemptions(workerBirthDate);

    // 국민연금: 보수월액을 천원 단위로 절사 후 계산, 최종 금액도 일의 단위(10원 미만) 절사
    const pensionBase = Math.floor(workerSalary / 1000) * 1000;
    const pension = pensionExempt ? 0 : floor10(pensionBase * RATES.pension / 2);

    // 건강보험 · 장기요양보험: 둘 다 일의 단위(10원 미만) 절사
    const health = floor10(workerSalary * RATES.health / 2);
    const longterm = floor10(health * RATES.longterm);
    const employment = employmentExempt ? 0 : floor10(workerSalary * RATES.employmentWorker);
    const total = pension + health + longterm + employment;
    const netPay = workerSalary - total;

    return {
        pension, health, longterm, employment, total, netPay,
        pensionExempt, employmentExempt, pensionExemptNextMonth, employmentExemptNextMonth
    };
}

// 근로자(단일) 계산 — 급여/생년월 입력칸을 직접 읽어서 계산
function calculateWorkerResult() {
    const salaryVal = parseMoney(document.getElementById('workerSalary').value);
    const bd = parseBirthdate(document.getElementById('workerBirth').value.trim());
    const errorEl = document.getElementById('workerInputError');

    if (!salaryVal || salaryVal <= 0 || !bd) {
        errorEl.style.display = 'block';
        document.getElementById('workerResultSection').style.display = 'none';
        return;
    }
    errorEl.style.display = 'none';

    salary = salaryVal;
    birthDate = bd;
    calc = computeWorkerShare(salary, birthDate);
    durunuriApplied = false;

    document.getElementById('workerResultSection').style.display = 'block';
    renderResult();
}

// 계산 결과를 화면에 반영
function renderResult() {
    document.getElementById('displaySalary').textContent = formatNumber(salary) + '원';
    document.getElementById('resultPension').textContent = formatNumber(calc.pension) + '원';
    document.getElementById('resultHealth').textContent = formatNumber(calc.health) + '원';
    document.getElementById('resultLongterm').textContent = formatNumber(calc.longterm) + '원';
    document.getElementById('resultEmployment').textContent = formatNumber(calc.employment) + '원';
    document.getElementById('resultTotal').textContent = formatNumber(calc.total) + '원';
    document.getElementById('resultNetPay').textContent = formatNumber(calc.netPay) + '원';
    ['resultPension', 'resultEmployment', 'resultTotal', 'resultNetPay'].forEach(id => {
        document.getElementById(id).classList.remove('value-changed');
    });

    // 항목 옆 요율 표시 (면제된 항목은 요율 대신 "면제"로 표시)
    document.getElementById('resultPensionRate').textContent = calc.pensionExempt ? '(면제)' : formatRate(RATES.pension / 2 * 100);
    document.getElementById('resultHealthRate').textContent = formatRate(RATES.health / 2 * 100);
    document.getElementById('resultLongtermRate').textContent = `(건강보험료 × ${roundRate(RATES.longterm * 100)}%)`;
    document.getElementById('resultEmploymentRate').textContent = calc.employmentExempt ? '(면제)' : formatRate(RATES.employmentWorker * 100);

    // 나이 관련 예외는 실제로 해당될 때만 안내
    const notices = [];
    if (calc.pensionExempt) notices.push('만 60세가 되어 국민연금은 계산에서 제외했어요.');
    if (calc.employmentExempt) notices.push('만 65세가 되어 고용보험(실업급여)도 제외했어요.');
    if (calc.pensionExemptNextMonth) notices.push('다음 달부터는 만 60세가 되어 국민연금이 제외돼요.');
    if (calc.employmentExemptNextMonth) notices.push('다음 달부터는 만 65세가 되어 고용보험(실업급여)도 제외돼요.');
    const ageNotice = document.getElementById('ageNotice');
    if (notices.length > 0) {
        ageNotice.textContent = 'ℹ️ ' + notices.join(' ');
        ageNotice.style.display = 'block';
    } else {
        ageNotice.style.display = 'none';
    }

    // 두루누리 배너: 월급여 270만원 이하일 때만 표시
    const durunuriBtn = document.getElementById('durunuriToggleBtn');
    durunuriBtn.textContent = '지원받으면 얼마?';
    durunuriBtn.classList.remove('applied');
    document.getElementById('durunuriBanner').style.display = salary <= 2700000 ? 'block' : 'none';
    document.getElementById('durunuriCapNotice').style.display = 'none';
}

// 산재보험료율 드롭다운에 업종 목록 채우기 (최초 1회)
function populateIndustryOptions(selectId) {
    const select = document.getElementById(selectId);
    if (!select || select.options.length > 0) return;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '업종을 선택해주세요';
    select.appendChild(placeholder);

    INDUSTRY_RATES.forEach((industry, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = `${industry.name} (${industry.permille}/1000)`;
        select.appendChild(option);
    });
}

// 사업주가 근로자 1명 때문에 부담하는 보험료 계산 (급여·생년월·업종을 받아 계산)
// (근로자 몫은 이 함수에서 계산 안 함 — computeWorkerShare가 따로 담당. 산재보험은 선택한 업종 요율로 추정 계산 — 실제 공단 분류와 다를 수 있음)
function computeEmployerShare(workerSalary, workerBirthDate, industryIdx) {
    const { pensionExempt, employmentExempt, pensionExemptNextMonth, employmentExemptNextMonth } = calculateExemptions(workerBirthDate);

    const pensionBase = Math.floor(workerSalary / 1000) * 1000;
    const pensionEmployer = pensionExempt ? 0 : floor10(pensionBase * RATES.pension / 2);

    const healthWorkerHalf = floor10(workerSalary * RATES.health / 2);
    const healthEmployer = healthWorkerHalf; // 건강보험은 나이 제한 없이 계속 부과됨 (근로자·사업주 절반씩 동일)

    const longtermEmployer = floor10(healthWorkerHalf * RATES.longterm);

    // 고용보험 사업주 몫: 실업급여분(0.9%, 65세 이상 제외)은 근로자와 동일하게 나이 영향을 받고,
    // 고용안정·직업능력개발사업분(0.25%)은 사업주 전용이라 나이와 무관하게 계속 부과됨
    const employmentEmployerRate = employmentExempt
        ? RATES.employmentStability
        : RATES.employmentWorker + RATES.employmentStability;
    const employmentEmployer = floor10(workerSalary * employmentEmployerRate);
    // 두루누리는 이 중 실업급여분에만 지원됨 (고용안정·직업능력개발분은 지원 대상 아님)
    const employmentUnemploymentEmployer = employmentExempt ? 0 : floor10(workerSalary * RATES.employmentWorker);

    // 산재보험 — 업종을 선택했을 때만 계산 (선택 전에는 총액에서 제외)
    let accidentEmployer = null;
    let accidentPermille = null;
    if (industryIdx !== '' && industryIdx !== null && industryIdx !== undefined) {
        const industry = INDUSTRY_RATES[parseInt(industryIdx, 10)];
        accidentEmployer = floor10(workerSalary * industry.permille / 1000);
        accidentPermille = industry.permille;
    }

    const total = pensionEmployer + healthEmployer + longtermEmployer + employmentEmployer + (accidentEmployer || 0);

    return {
        pensionEmployer, healthEmployer, longtermEmployer, employmentEmployer, employmentUnemploymentEmployer, accidentEmployer, total,
        pensionExempt, employmentExempt, pensionExemptNextMonth, employmentExemptNextMonth,
        employmentEmployerRate, accidentPermille
    };
}

// 사업주 본인 보험료 계산 — 근로자와 달리 사업주(대표자)는 고용보험·산재보험 가입 대상이 아니므로
// 국민연금·건강보험(+장기요양)만 계산함 (고용·산재는 아예 계산하지 않음)
// 사업주 본인은 자신을 고용하는 별도의 "사업주"가 없어서, 직원처럼 절반만 내는 게
// 아니라 국민연금·건강보험료 전액을 본인이 부담한다 (2026-10-02 버그 수정: 그동안
// RATES.pension/2, RATES.health/2로 절반만 계산되고 있었음)
function computeOwnerShare(ownerSalary, ownerBirthDate) {
    const { pensionExempt, pensionExemptNextMonth } = calculateExemptions(ownerBirthDate);

    const pensionBase = Math.floor(ownerSalary / 1000) * 1000;
    const pensionEmployer = pensionExempt ? 0 : floor10(pensionBase * RATES.pension);

    const healthEmployer = floor10(ownerSalary * RATES.health);
    const longtermEmployer = floor10(healthEmployer * RATES.longterm);

    const total = pensionEmployer + healthEmployer + longtermEmployer;

    return { pensionEmployer, healthEmployer, longtermEmployer, total, pensionExempt, pensionExemptNextMonth };
}

// 두루누리 지원 적용 시 본인 부담액 (80% 지원, 상한액 있으면 상한액만큼만 지원)
function durunuriSupportedAmount(original, cap) {
    const support80 = floor10(original * 0.8);
    if (support80 > cap) {
        return original - cap;
    }
    return floor10(original * 0.2);
}

// 80% 지원금이 상한액을 넘어서, 실제로 상한액만큼만 지원된 경우인지
function durunuriCapApplied(original, cap) {
    return floor10(original * 0.8) > cap;
}

// 상한액이 적용된 항목이 있을 때만 안내 문구를 만들어 반환 (없으면 빈 문자열)
function durunuriCapNoticeText(pensionCapped, employmentCapped) {
    if (!pensionCapped && !employmentCapped) return '';
    const items = [];
    if (pensionCapped) items.push(`국민연금 ${formatNumber(DURUNURI_CAPS.pension)}원`);
    if (employmentCapped) items.push(`고용보험 ${formatNumber(DURUNURI_CAPS.employmentWorker)}원`);
    return `※ 월급여가 높아 지원금이 상한액(${items.join(', ')})까지만 적용됐어요.`;
}

// 두루누리 지원 토글 (근로자 단일 계산)
function toggleDurunuri() {
    durunuriApplied = !durunuriApplied;
    const btn = document.getElementById('durunuriToggleBtn');
    const capNotice = document.getElementById('durunuriCapNotice');

    let pension = calc.pension;
    let employment = calc.employment;
    let pensionCapped = false;
    let employmentCapped = false;

    if (durunuriApplied) {
        if (!calc.pensionExempt) {
            pensionCapped = durunuriCapApplied(calc.pension, DURUNURI_CAPS.pension);
            pension = durunuriSupportedAmount(calc.pension, DURUNURI_CAPS.pension);
        }
        if (!calc.employmentExempt) {
            employmentCapped = durunuriCapApplied(calc.employment, DURUNURI_CAPS.employmentWorker);
            employment = durunuriSupportedAmount(calc.employment, DURUNURI_CAPS.employmentWorker);
        }
        btn.textContent = '원래 금액 보기';
        btn.classList.add('applied');
    } else {
        pension = calc.pension;
        employment = calc.employment;
        btn.textContent = '지원받으면 얼마?';
        btn.classList.remove('applied');
    }

    const capNoticeText = durunuriCapNoticeText(pensionCapped, employmentCapped);
    capNotice.textContent = capNoticeText;
    capNotice.style.display = capNoticeText ? '' : 'none';

    const total = pension + calc.health + calc.longterm + employment;
    const netPay = salary - total;
    document.getElementById('resultPension').textContent = formatNumber(pension) + '원';
    document.getElementById('resultEmployment').textContent = formatNumber(employment) + '원';
    document.getElementById('resultTotal').textContent = formatNumber(total) + '원';
    document.getElementById('resultNetPay').textContent = formatNumber(netPay) + '원';

    // 두루누리 적용으로 바뀐 금액은 색을 다르게 해서 눈에 띄게 한다
    const changedIds = ['resultPension', 'resultEmployment', 'resultTotal', 'resultNetPay'];
    changedIds.forEach(id => {
        document.getElementById(id).classList.toggle('value-changed', durunuriApplied);
    });
}

// 근로자 입력 줄 하나 추가 (생년월 + 급여) — 사업주 경로에서 인원수만큼 늘림
function addMultiWorkerRow() {
    const container = document.getElementById('multiWorkerRows');
    const row = document.createElement('div');
    row.className = 'multi-worker-row';
    row.innerHTML = `
        <div class="mw-row-num">${container.children.length + 1}</div>
        <div class="mw-row-inputs">
            <input type="text" class="mw-birth" inputmode="numeric" placeholder="생년월 (예:199001)" maxlength="6" autocomplete="new-password">
            <input type="text" class="mw-salary money-input" inputmode="numeric" placeholder="월급여" autocomplete="new-password">
        </div>
    `;
    container.appendChild(row);
}

// 맨 아래 줄 삭제 (최소 1줄은 남겨둠)
function removeMultiWorkerRow() {
    const container = document.getElementById('multiWorkerRows');
    if (container.children.length <= 1) return;
    container.removeChild(container.lastElementChild);
}

// 사업주 경로에 처음 들어왔을 때 기본 2줄 준비 (이미 입력한 값이 있으면 그대로 유지)
function initMultiWorkerRows() {
    const container = document.getElementById('multiWorkerRows');
    if (container.children.length > 0) return;
    addMultiWorkerRow();
    addMultiWorkerRow();
}

// "사업주 본인 보험료도 함께 계산" 체크박스 — 체크하면 생년월·기준급여 입력칸이 나타남 (선택 사항)
function toggleOwnerInputs() {
    const checked = document.getElementById('includeOwnerCheckbox').checked;
    const row = document.getElementById('ownerInputRow');
    row.style.display = checked ? 'flex' : 'none';
    if (!checked) {
        document.getElementById('ownerBirth').value = '';
        document.getElementById('ownerSalary').value = '';
    }
}

// ============================================================
// 전문가용 — "한 달 총 부과 금액" (근로자 공제분 + 사업주 부담분을 전부 합친 실제 고지서 기준 총액)
// 사업주 화면과 별개의 독립 입력란을 씀(재입력 필요) — 기본 화면은 단순 계산 전용으로 유지하려는 설계 원칙
// ============================================================
function addTotalBillWorkerRow() {
    const container = document.getElementById('totalBillWorkerRows');
    const n = container.children.length + 1;
    const row = document.createElement('div');
    // 한 사람 = 한 줄 (PC는 표처럼 7칸, 휴대폰은 4칸 + 외국인 체크 시 아래에 선택칸 상자)
    row.className = 'multi-worker-row tb-row';
    row.innerHTML = `
        <span class="mw-row-num">${n}</span>
        <input type="text" class="mw-birth xp-input" inputmode="numeric" placeholder="예: 199001" maxlength="6" autocomplete="new-password" aria-label="${n}번 생년월">
        <input type="text" class="mw-salary money-input xp-input" inputmode="numeric" placeholder="월급여" autocomplete="new-password" aria-label="${n}번 월급여">
        <label class="tb-foreign-toggle"><input type="checkbox" class="tb-foreign-check" onchange="toggleTotalBillForeign(this)" aria-label="${n}번 외국인"></label>
        <span class="tb-foreign-off" aria-hidden="true"><span>—</span><span>—</span><span>—</span></span>
        <div class="tb-foreign-panel" style="display:none;">
            <select class="tb-visa xp-input" onchange="updateTotalBillJoin(this)" aria-label="${n}번 체류자격"></select>
            <select class="tb-country xp-input" aria-label="${n}번 국적"></select>
            <select class="tb-join xp-input" style="display:none;" aria-label="${n}번 실업급여 가입"></select>
        </div>
    `;
    fillSelectOptions(row.querySelector('.tb-visa'), '체류자격', VISA_TYPES, v => `${v.code} (${v.name})`);
    fillSelectOptions(row.querySelector('.tb-country'), '국적', PENSION_COUNTRIES, c => c.name);
    container.appendChild(row);
    updateTotalBillCount();
}

// 명단 위 "근로자 명단 N명" 표시
function updateTotalBillCount() {
    document.getElementById('totalBillCount').textContent = `${document.getElementById('totalBillWorkerRows').children.length}명`;
}

function fillSelectOptions(select, placeholder, items, labelOf) {
    select.innerHTML = `<option value="">${placeholder}</option>` +
        items.map((item, idx) => `<option value="${idx}">${labelOf(item)}</option>`).join('');
}

function toggleTotalBillForeign(checkbox) {
    const row = checkbox.closest('.tb-row');
    row.querySelector('.tb-foreign-panel').style.display = checkbox.checked ? 'grid' : 'none';
    row.classList.toggle('is-foreign', checkbox.checked);
}

// 실업급여(또는 고용보험 전체)를 근로자가 신청해야 가입되는 체류자격일 때만 가입 여부 칸을 보여줌
function updateTotalBillJoin(visaSelect) {
    const joinSelect = visaSelect.closest('.tb-foreign-panel').querySelector('.tb-join');
    const visa = visaSelect.value === '' ? null : VISA_TYPES[parseInt(visaSelect.value, 10)];
    if (!visa || (visa.employment !== 'partial' && visa.employment !== 'optional')) {
        joinSelect.style.display = 'none';
        joinSelect.innerHTML = '';
        return;
    }
    const what = visa.employment === 'partial' ? '실업급여' : '고용보험(실업급여)';
    joinSelect.innerHTML = `<option value="no">${what} 가입 신청 안 함</option><option value="yes">${what} 가입 신청함</option>`;
    joinSelect.style.display = 'block';
}

// 맨 아래 줄 삭제 (최소 1줄은 남겨둠)
function removeTotalBillWorkerRow() {
    const container = document.getElementById('totalBillWorkerRows');
    if (container.children.length <= 1) return;
    container.removeChild(container.lastElementChild);
    updateTotalBillCount();
}

// 이 항목을 처음 펼쳤을 때 기본 2줄 준비 (이미 입력한 값이 있으면 그대로 유지)
function initTotalBillWorkerRows() {
    const container = document.getElementById('totalBillWorkerRows');
    if (container.children.length > 0) return;
    addTotalBillWorkerRow();
    addTotalBillWorkerRow();
}

// 사업주 유형 선택(개인사업자/법인 유보수/법인 무보수) — 무보수는 보수 자체가 없어
// 생년월·급여 입력칸이 필요 없으므로 숨김. 나머지 둘은 계속 입력받음(항상 필수 — 선택사항 아님)
function toggleTotalBillOwnerInputs() {
    const ownerType = document.querySelector('input[name="totalBillOwnerType"]:checked').value;
    const row = document.getElementById('totalBillOwnerInputRow');
    const isUnpaid = ownerType === 'unpaidCorp';
    row.style.display = isUnpaid ? 'none' : 'flex';
    if (isUnpaid) {
        document.getElementById('totalBillOwnerBirth').value = '';
        document.getElementById('totalBillOwnerSalary').value = '';
    }
}

// 사업주 본인의 국민연금·건강보험료를 유형별로 계산 (기본 "사업주" 화면의 computeOwnerShare와
// 별개 — 기본 화면은 개인사업자만 다루는 단순 계산으로 유지하고, 법인 대표 구분은 전문가용에서만 다룸)
// - 개인사업자: 별도 고용주가 없어 전액 본인(self) 혼자 부담, 법인(company) 몫은 0
// - 법인 대표(유보수): 일반 근로자처럼 본인(self)·법인(company)이 절반씩 — 총액(pension/health/longterm,
//   total)은 반드시 두 몫을 합친 전체 금액이어야 함(총 부과 금액 집계에 절반만 반영되면 안 됨)
// - 법인 대표(무보수): 보수가 없어 전부 0
function computeOwnerShareByType(ownerType, ownerSalary, ownerBirthDate) {
    if (ownerType === 'unpaidCorp') {
        return {
            selfPension: 0, selfHealth: 0, selfLongterm: 0,
            companyPension: 0, companyHealth: 0, companyLongterm: 0,
            pension: 0, health: 0, longterm: 0, total: 0,
            pensionExempt: false, pensionExemptNextMonth: false
        };
    }

    const { pensionExempt, pensionExemptNextMonth } = calculateExemptions(ownerBirthDate);
    const pensionBase = Math.floor(ownerSalary / 1000) * 1000;

    if (ownerType === 'individual') {
        const pension = pensionExempt ? 0 : floor10(pensionBase * RATES.pension);
        const health = floor10(ownerSalary * RATES.health);
        const longterm = floor10(health * RATES.longterm);
        return {
            selfPension: pension, selfHealth: health, selfLongterm: longterm,
            companyPension: 0, companyHealth: 0, companyLongterm: 0,
            pension, health, longterm, total: pension + health + longterm,
            pensionExempt, pensionExemptNextMonth
        };
    }

    // paidCorp
    const halfPension = pensionExempt ? 0 : floor10(pensionBase * RATES.pension / 2);
    const halfHealth = floor10(ownerSalary * RATES.health / 2);
    const halfLongterm = floor10(halfHealth * RATES.longterm);
    return {
        selfPension: halfPension, selfHealth: halfHealth, selfLongterm: halfLongterm,
        companyPension: halfPension, companyHealth: halfHealth, companyLongterm: halfLongterm,
        pension: halfPension * 2, health: halfHealth * 2, longterm: halfLongterm * 2,
        total: (halfPension + halfHealth + halfLongterm) * 2,
        pensionExempt, pensionExemptNextMonth
    };
}

// 근로자 전원의 (공제분+부담분) + 사업주 본인 몫을 전부 합산해서, 실제 통합고지서와 맞는
// 항목별 총액 + 전체 합계를 계산 (두루누리 지원 전의 순수 부과 기준 금액)
function calculateTotalBill() {
    const rows = document.querySelectorAll('#totalBillWorkerRows .multi-worker-row');
    const industryIdx = document.getElementById('totalBillIndustryType').value;
    const errorEl = document.getElementById('totalBillInputError');
    const resultBox = document.getElementById('totalBillResult');

    const workers = [];
    let hasError = false;

    rows.forEach(row => {
        const birthRaw = row.querySelector('.mw-birth').value.trim();
        const salaryRaw = row.querySelector('.mw-salary').value.trim();

        if (!birthRaw && !salaryRaw) {
            row.classList.remove('mw-row-error');
            return; // 완전히 빈 줄은 건너뜀
        }

        const workerSalary = parseMoney(salaryRaw);
        const bd = parseBirthdate(birthRaw);

        // 외국인으로 표시한 줄은 체류자격·국적까지 골라야 계산할 수 있음
        let foreign = null;
        if (row.querySelector('.tb-foreign-check').checked) {
            const visaIdx = row.querySelector('.tb-visa').value;
            const countryIdx = row.querySelector('.tb-country').value;
            if (visaIdx !== '' && countryIdx !== '') {
                const visa = VISA_TYPES[parseInt(visaIdx, 10)];
                const country = PENSION_COUNTRIES[parseInt(countryIdx, 10)];
                foreign = {
                    visa, country,
                    pensionApplies: !visa.pensionExcluded && !country.exempt,
                    employmentMode: foreignerEmploymentMode(visa, row.querySelector('.tb-join').value === 'yes'),
                };
            } else {
                foreign = 'incomplete';
            }
        }

        if (!bd || !workerSalary || workerSalary <= 0 || foreign === 'incomplete') {
            row.classList.add('mw-row-error');
            hasError = true;
            return;
        }

        row.classList.remove('mw-row-error');
        workers.push({ salary: workerSalary, birthDate: bd, foreign });
    });

    if (hasError) {
        errorEl.textContent = '⚠️ 빨간색으로 표시된 줄의 생년월(6자리)과 급여를 확인해주세요. 외국인으로 표시한 줄은 체류자격과 국적도 골라야 해요.';
        errorEl.style.display = 'block';
        resultBox.style.display = 'none';
        return;
    }

    // 사업주 본인 몫은 선택사항이 아니라 항상 계산에 포함함 (무보수 법인 대표만 예외적으로 0원)
    const ownerType = document.querySelector('input[name="totalBillOwnerType"]:checked').value;
    let ownerShare;
    let ownerBd = null;  // 화면 결과의 "사업주 본인" 줄에 생년월 표시용

    if (ownerType === 'unpaidCorp') {
        ownerShare = computeOwnerShareByType('unpaidCorp', 0, '');
    } else {
        const ownerBirthRaw = document.getElementById('totalBillOwnerBirth').value.trim();
        const ownerSalaryRaw = document.getElementById('totalBillOwnerSalary').value.trim();
        ownerBd = parseBirthdate(ownerBirthRaw);
        const ownerSalaryVal = parseMoney(ownerSalaryRaw);

        if (!ownerBd || !ownerSalaryVal || ownerSalaryVal <= 0) {
            errorEl.textContent = '⚠️ 사업주 본인의 생년월(6자리)과 기준급여를 올바르게 입력해주세요.';
            errorEl.style.display = 'block';
            resultBox.style.display = 'none';
            return;
        }

        ownerShare = computeOwnerShareByType(ownerType, ownerSalaryVal, ownerBd);
    }

    errorEl.style.display = 'none';

    // PDF 저장 시 재사용할 수 있도록 근로자별 상세 계산 결과를 그대로 보관해둠
    totalBillWorkersCalc = workers.map(w => {
        const shares = w.foreign
            ? computeForeignerShares(w.salary, w.birthDate, industryIdx, w.foreign.pensionApplies, w.foreign.employmentMode)
            : { w: computeWorkerShare(w.salary, w.birthDate), e: computeEmployerShare(w.salary, w.birthDate, industryIdx) };
        return {
            salary: w.salary,
            birthDate: w.birthDate,
            foreign: w.foreign,
            workerShare: shares.w,
            employerShare: shares.e,
        };
    });
    totalBillOwnerCalc = { ownerType, salary: ownerType === 'unpaidCorp' ? 0 : parseMoney(document.getElementById('totalBillOwnerSalary').value), ownerShare };
    totalBillIndustryIdx = industryIdx;

    let totalPension = 0, totalHealth = 0, totalLongterm = 0, totalEmployment = 0, totalAccident = 0;

    totalBillWorkersCalc.forEach(({ workerShare, employerShare }) => {
        totalPension += workerShare.pension + employerShare.pensionEmployer;
        totalHealth += workerShare.health + employerShare.healthEmployer;
        totalLongterm += workerShare.longterm + employerShare.longtermEmployer;
        totalEmployment += workerShare.employment + employerShare.employmentEmployer;
        totalAccident += (employerShare.accidentEmployer || 0);
    });

    // 사업주 본인은 국민연금·건강보험·장기요양만 해당(고용·산재보험 대상 아님)
    // ownerShare.pension/health/longterm은 유형과 무관하게 항상 "본인+법인 몫을 합친 전체 금액"임
    totalPension += ownerShare.pension;
    totalHealth += ownerShare.health;
    totalLongterm += ownerShare.longterm;

    const grandTotal = totalPension + totalHealth + totalLongterm + totalEmployment + totalAccident;

    resultBox.innerHTML = buildTotalBillResultHTML(grandTotal, ownerBd);
    resultBox.style.display = 'block';
}

const XP_INFO_ICON = '<svg class="xp-info-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
const XP_PDF_ICON = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';

// {year, month} → "1985.04"
function birthLabel(bd) {
    return bd ? `${bd.year}.${String(bd.month).padStart(2, '0')}` : '';
}

// 한 달 총 부과 금액 — 화면 결과 (calculateTotalBill이 저장해 둔 totalBillWorkersCalc·totalBillOwnerCalc로 그림)
// 두루누리 적용 시 총액은 PDF와 같은 함수(hasDurunuri, computeDurunuriDeduction/Burden)로 계산
function buildTotalBillResultHTML(grandTotal, ownerBd) {
    const n = v => formatNumber(v);
    const { ownerType, salary: ownerSalary, ownerShare: os } = totalBillOwnerCalc;

    // 사업주 본인 몫의 자리: 법인 유보수는 본인 몫이 "근로자 공제분", 법인 몫이 "사업주 부담분"
    // 개인사업자는 전액 "사업주 부담분" (PDF 표와 같은 기준)
    const ownerW = ownerType === 'paidCorp'
        ? { pension: os.selfPension, health: os.selfHealth, longterm: os.selfLongterm }
        : { pension: 0, health: 0, longterm: 0 };
    const ownerE = { pension: os.pension - ownerW.pension, health: os.health - ownerW.health, longterm: os.longterm - ownerW.longterm };
    const ownerWTotal = ownerW.pension + ownerW.health + ownerW.longterm;
    const ownerETotal = ownerE.pension + ownerE.health + ownerE.longterm;

    const sumW = { pension: ownerW.pension, health: ownerW.health, longterm: ownerW.longterm, employment: 0, total: ownerWTotal };
    const sumE = { pension: ownerE.pension, health: ownerE.health, longterm: ownerE.longterm, employment: 0, accident: 0, total: ownerETotal };
    let durunuriSaving = 0;
    const durunuriNums = [];
    let accidentUnselected = false;

    let tableRows = '';
    let cards = '';
    totalBillWorkersCalc.forEach((w, idx) => {
        const d = w.workerShare;
        const b = w.employerShare;
        sumW.pension += d.pension; sumW.health += d.health; sumW.longterm += d.longterm; sumW.employment += d.employment; sumW.total += d.total;
        sumE.pension += b.pensionEmployer; sumE.health += b.healthEmployer; sumE.longterm += b.longtermEmployer;
        sumE.employment += b.employmentEmployer; sumE.accident += (b.accidentEmployer || 0); sumE.total += b.total;
        if (b.accidentEmployer === null) accidentUnselected = true;

        const dn = hasDurunuri(w.salary, d);
        if (dn) {
            durunuriSaving += (d.total - computeDurunuriDeduction(d, w.salary).total) + (b.total - computeDurunuriBurden(b).total);
            durunuriNums.push(`${idx + 1}번`);
        }

        // 적용 제외 항목은 0 대신 흐린 "제외", 비고에 사유
        const pensionOff = d.pensionExempt || (w.foreign && !w.foreign.pensionApplies);
        const exemptNotes = [];
        if (d.pensionExempt) exemptNotes.push('60세 이상 연금 제외');
        else if (w.foreign && !w.foreign.pensionApplies) exemptNotes.push('연금 적용 제외');
        if (d.employmentExempt) exemptNotes.push('65세 이상 실업급여 제외');

        const tags = [];
        if (dn) tags.push('<span class="xp-tag dn">두루누리</span>');
        if (w.foreign) tags.push(`<span class="xp-tag fg">외국인 ${w.foreign.visa.code} · ${w.foreign.country.name}</span>`);
        if (exemptNotes.length) tags.push(`<span class="xp-tag off">${exemptNotes.join(' · ')}</span>`);
        if (w.foreign && w.foreign.employmentMode !== 'all') {
            tags.push(`<span class="xp-note">${w.foreign.employmentMode === 'stabilityOnly' ? '실업급여 미가입' : '고용보험 0원 계산'}</span>`);
        }

        const offCell = '<td class="xp-off">제외</td>';
        tableRows += `
            <tr${w.foreign ? ' class="is-foreign"' : ''}>
                <td class="xp-num-col">${idx + 1}</td>
                <td class="xp-left">${birthLabel(w.birthDate)}</td>
                <td>${n(w.salary)}</td>
                ${pensionOff ? offCell : `<td>${n(d.pension)}</td>`}
                <td>${n(d.health)}</td>
                <td>${n(d.longterm)}</td>
                ${d.employmentExempt ? offCell : `<td${d.employment === 0 ? ' class="xp-off"' : ''}>${n(d.employment)}</td>`}
                <td class="xp-strong">${n(d.total)}</td>
                <td class="xp-strong">${n(b.total)}</td>
                <td class="xp-left xp-memo">${tags.join(' ')}</td>
            </tr>`;
        cards += `
            <li class="xp-card">
                <div class="xp-card-top"><span><b>${idx + 1}</b> · ${birthLabel(w.birthDate)} ${tags.filter(t => !t.includes('xp-note')).join(' ')}</span><span>월 ${n(w.salary)}</span></div>
                <div class="xp-card-bottom"><span>공제 <b>${n(d.total)}</b></span><span>사업주 <b>${n(b.total)}</b></span></div>
            </li>`;
    });

    const ownerTypeLabel = { individual: '개인사업자 · 본인 전액 부담', paidCorp: '법인 대표(유보수) · 본인·법인 절반씩', unpaidCorp: '법인 대표(무보수) · 보수 없음' }[ownerType];
    const ownerSalaryText = ownerType === 'unpaidCorp' ? '—' : n(ownerSalary);
    const ownerWCells = ownerType === 'paidCorp'
        ? `<td>${n(ownerW.pension)}</td><td>${n(ownerW.health)}</td><td>${n(ownerW.longterm)}</td><td class="xp-off">—</td><td class="xp-strong">${n(ownerWTotal)}</td>`
        : '<td colspan="5" class="xp-center xp-off">—</td>';
    tableRows += `
        <tr class="xp-owner-row">
            <td colspan="2" class="xp-left"><b>사업주 본인</b> <span class="xp-sub-inline">${birthLabel(ownerBd)}</span></td>
            <td>${ownerSalaryText}</td>
            ${ownerWCells}
            <td class="xp-strong">${n(ownerETotal)}</td>
            <td class="xp-left xp-memo"><span class="xp-note">${ownerTypeLabel}</span></td>
        </tr>
        <tr class="xp-sum-row">
            <td colspan="3" class="xp-left">합계</td>
            <td>${n(sumW.pension)}</td><td>${n(sumW.health)}</td><td>${n(sumW.longterm)}</td><td>${n(sumW.employment)}</td>
            <td>${n(sumW.total)}</td><td>${n(sumE.total)}</td><td></td>
        </tr>`;
    cards += `
        <li class="xp-card xp-owner-row">
            <div class="xp-card-top"><span><b>사업주 본인</b>${ownerBd ? ` · ${birthLabel(ownerBd)}` : ''} · ${ownerTypeLabel.split(' · ')[0]}</span><span>${ownerType === 'unpaidCorp' ? '' : `월 ${n(ownerSalary)}`}</span></div>
            <div class="xp-card-bottom"><span${ownerWTotal ? '' : ' class="xp-off"'}>공제 ${ownerWTotal ? `<b>${n(ownerWTotal)}</b>` : '—'}</span><span>${ownerType === 'individual' ? '본인 부담' : '사업주'} <b>${n(ownerETotal)}</b></span></div>
        </li>`;

    const itemRow = (name, wv, ev) => `<tr><td>${name}</td><td${wv === null ? ' class="xp-off"' : ''}>${wv === null ? '—' : n(wv)}</td><td>${ev === null ? '<span class="xp-off">업종 미선택</span>' : n(ev)}</td><td class="xp-strong">${n((wv || 0) + (ev || 0))}</td></tr>`;

    const dnBlock = durunuriNums.length ? `
        <div class="xp-total-dn">
            <span class="xp-total-dn-label"><span class="xp-tag dn">두루누리 적용 시</span><span class="xp-total-dn-who">대상 ${durunuriNums.length}명 · ${durunuriNums.join(', ')}</span></span>
            <span class="xp-total-dn-amount">${n(grandTotal - durunuriSaving)}원</span>
        </div>` : '';

    const notes = [];
    if (totalBillWorkersCalc.some(w => w.foreign)) notes.push('외국인으로 표시한 근로자는 체류자격·국적 판정대로 국민연금·고용보험을 계산했어요.');
    notes.push('근로자 공제분과 사업주 부담분(사업주 본인 몫 포함)을 모두 합친, 실제 4대보험 통합고지서 기준 총 부과 금액이에요.<br><b>두루누리 지원금은 반영되지 않은 금액입니다.</b><br>산재보험료는 선택하신 업종 기준 요율로 계산한 참고용 금액이며, 정확한 산재보험료율은 근로복지공단(<a href="tel:1588-0075">1588-0075</a>)에 별도로 확인해주세요.');

    return `
        <div class="xp-summary">
            <div class="xp-summary-main">
                <div class="xp-total">
                    <p class="xp-total-label">총 고지 예상 금액</p>
                    <p class="xp-total-amount">${n(grandTotal)}<span>원</span></p>
                    ${dnBlock}
                </div>
                <div class="xp-split">
                    <div><p>근로자 공제분</p><p class="xp-split-amount">${n(sumW.total)}원</p></div>
                    <div><p>사업주 부담분 <span>(본인 몫 포함)</span></p><p class="xp-split-amount">${n(sumE.total)}원</p></div>
                </div>
            </div>
            <table class="xp-table xp-ins-table">
                <caption>보험별 합계 <span>(원)</span></caption>
                <thead><tr><th scope="col">항목</th><th scope="col"><span class="pc-only-inline">근로자 공제분</span><span class="m-only-inline">근로자</span></th><th scope="col"><span class="pc-only-inline">사업주 부담분</span><span class="m-only-inline">사업주</span></th><th scope="col">합계</th></tr></thead>
                <tbody>
                    ${itemRow('국민연금', sumW.pension, sumE.pension)}
                    ${itemRow('건강보험', sumW.health, sumE.health)}
                    ${itemRow('장기요양보험', sumW.longterm, sumE.longterm)}
                    ${itemRow('고용보험', sumW.employment, sumE.employment)}
                    ${itemRow('산재보험', null, accidentUnselected && sumE.accident === 0 ? null : sumE.accident)}
                    <tr class="xp-sum-row"><td>합계</td><td>${n(sumW.total)}</td><td>${n(sumE.total)}</td><td class="xp-sum-accent">${n(grandTotal)}</td></tr>
                </tbody>
            </table>
        </div>

        <div class="xp-workers">
            <h3 class="xp-h3">근로자별 내역 <span>(원)</span></h3>
            <div class="xp-table-wrap pc-only-block">
                <table class="xp-table xp-worker-table">
                    <thead>
                        <tr><th rowspan="2" scope="col" class="xp-num-col">#</th><th rowspan="2" scope="col" class="xp-left">생년월</th><th rowspan="2" scope="col">월급여</th><th colspan="5" scope="colgroup" class="xp-center xp-group-head">근로자 공제분</th><th rowspan="2" scope="col">사업주 부담분</th><th rowspan="2" scope="col" class="xp-left xp-memo">비고</th></tr>
                        <tr><th scope="col">국민연금</th><th scope="col">건강</th><th scope="col">장기요양</th><th scope="col">고용</th><th scope="col">합계</th></tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            <ul class="xp-cards m-only-block">${cards}</ul>
        </div>

        <div class="xp-foot">
            <div class="xp-notes">
                <p class="xp-notes-title">참고</p>
                <ul>${notes.map(t => `<li>${XP_INFO_ICON}<span>${t}</span></li>`).join('')}</ul>
            </div>
            <button class="btn-primary xp-pdf-btn" onclick="printTotalBill()">${XP_PDF_ICON}PDF로 저장 <span class="xp-pdf-sub">(근로자별 상세 내역 포함)</span></button>
        </div>`;
}

// 근로자 여러명 결과에서 특정 근로자 줄을 탭하면 그 자리에서 상세 항목이 펼쳐짐
function toggleMwDetail(type, idx) {
    const detail = document.getElementById(`${type}Detail${idx}`);
    const icon = document.getElementById(`${type}Icon${idx}`);
    const isOpen = detail.classList.toggle('open');
    icon.textContent = isOpen ? '접기 ▴' : '자세히 ▾';
}

// 근로자 여러명 결과 — idx번째 근로자의 "현재 화면에 보이는" 공제 내역 계산 (두루누리 토글 상태 반영)
// key가 'owner'면 사업주 본인 계산 결과를, 그 외(숫자)면 근로자 목록에서 찾아서 반환
function getMwRecord(key) {
    return key === 'owner' ? ownerCalc : employerWorkersCalc[key];
}

function getEffectiveWorkerShare(idx) {
    const w = getMwRecord(idx);
    const s = w.workerShare;
    const applied = !!mwDurunuriApplied.deduction[idx];

    let pension = s.pension;
    let employment = s.employment;
    let pensionCapped = false;
    let employmentCapped = false;
    if (applied) {
        if (!s.pensionExempt) {
            pensionCapped = durunuriCapApplied(s.pension, DURUNURI_CAPS.pension);
            pension = durunuriSupportedAmount(s.pension, DURUNURI_CAPS.pension);
        }
        if (!s.employmentExempt) {
            employmentCapped = durunuriCapApplied(s.employment, DURUNURI_CAPS.employmentWorker);
            employment = durunuriSupportedAmount(s.employment, DURUNURI_CAPS.employmentWorker);
        }
    }
    const total = pension + s.health + s.longterm + employment;
    const netPay = w.salary - total;

    return { pension, health: s.health, longterm: s.longterm, employment, total, netPay, applied, pensionCapped, employmentCapped };
}

// 근로자 여러명 결과 — idx번째 근로자의 "현재 화면에 보이는" 사업주 부담 내역 계산 (두루누리 토글 상태 반영)
function getEffectiveEmployerShare(idx) {
    const w = getMwRecord(idx);
    const s = w.employerShare;
    const applied = !!mwDurunuriApplied.burden[idx];

    let pension = s.pensionEmployer;
    let employment = s.employmentEmployer;
    let pensionCapped = false;
    let employmentCapped = false;
    if (applied) {
        if (!s.pensionExempt) {
            pensionCapped = durunuriCapApplied(s.pensionEmployer, DURUNURI_CAPS.pension);
            pension = durunuriSupportedAmount(s.pensionEmployer, DURUNURI_CAPS.pension);
        }
        ({ employment, capped: employmentCapped } = durunuriEmployerEmployment(s));
    }
    const accident = s.accidentEmployer || 0;
    const total = pension + s.healthEmployer + s.longtermEmployer + employment + accident;

    return { pension, health: s.healthEmployer, longterm: s.longtermEmployer, employment, accident, total, applied, pensionCapped, employmentCapped };
}

// 사업주 고용보험에 두루누리 적용 — 실업급여분만 지원하고 고용안정·직업능력개발분은 그대로 부담
function durunuriEmployerEmployment(s) {
    const unemployment = s.employmentUnemploymentEmployer;
    const stability = s.employmentEmployer - unemployment;
    return {
        employment: durunuriSupportedAmount(unemployment, DURUNURI_CAPS.employmentWorker) + stability,
        capped: durunuriCapApplied(unemployment, DURUNURI_CAPS.employmentWorker),
    };
}

// PDF 저장용 — 화면 토글 상태와 무관하게 "두루누리를 적용했다면"의 금액을 그대로 계산 (대상자는 PDF에 항상 같이 표시)
// 두루누리 금액을 보여줄 사람인지: 월급여 270만원 이하 + 실제로 지원받을 보험료가 있어야 함
// (외국인 중 국민연금은 지원 없고 실업급여도 부과되지 않는 경우는 지원액이 0이라 제외)
function hasDurunuri(salary, share) {
    return salary <= 2700000 && !share.durunuriNone;
}

function computeDurunuriDeduction(s, salary) {
    const noPensionSupport = s.pensionExempt || s.noPensionDurunuri;
    const pensionCapped = !noPensionSupport && durunuriCapApplied(s.pension, DURUNURI_CAPS.pension);
    const employmentCapped = !s.employmentExempt && durunuriCapApplied(s.employment, DURUNURI_CAPS.employmentWorker);
    const pension = noPensionSupport ? s.pension : durunuriSupportedAmount(s.pension, DURUNURI_CAPS.pension);
    const employment = s.employmentExempt ? s.employment : durunuriSupportedAmount(s.employment, DURUNURI_CAPS.employmentWorker);
    const total = pension + s.health + s.longterm + employment;
    const netPay = salary - total;
    return { pension, health: s.health, longterm: s.longterm, employment, total, netPay, pensionCapped, employmentCapped };
}

function computeDurunuriBurden(s) {
    const noPensionSupport = s.pensionExempt || s.noPensionDurunuri;
    const pensionCapped = !noPensionSupport && durunuriCapApplied(s.pensionEmployer, DURUNURI_CAPS.pension);
    const pension = noPensionSupport ? s.pensionEmployer : durunuriSupportedAmount(s.pensionEmployer, DURUNURI_CAPS.pension);
    const { employment, capped: employmentCapped } = durunuriEmployerEmployment(s);
    const accident = s.accidentEmployer || 0;
    const total = pension + s.healthEmployer + s.longtermEmployer + employment + accident;
    return { pension, health: s.healthEmployer, longterm: s.longtermEmployer, employment, accident, total, pensionCapped, employmentCapped };
}

// 근로자 여러명 결과 — 특정 근로자 1명에 대해서만 두루누리 지원 적용 시 금액을 보여줌
function toggleMwDurunuri(type, idx) {
    mwDurunuriApplied[type][idx] = !mwDurunuriApplied[type][idx];

    const btn = document.getElementById(`${type}DurunuriBtn${idx}`);
    const applied = mwDurunuriApplied[type][idx];
    btn.textContent = applied ? '원래 금액 보기' : '두루누리 지원받으면 얼마?';
    btn.classList.toggle('applied', applied);

    if (type === 'deduction') {
        const eff = getEffectiveWorkerShare(idx);

        document.getElementById(`deductionPension${idx}`).textContent = formatNumber(eff.pension) + '원';
        document.getElementById(`deductionEmployment${idx}`).textContent = formatNumber(eff.employment) + '원';
        document.getElementById(`deductionSummaryTotal${idx}`).textContent = formatNumber(eff.total) + '원';
        document.getElementById(`deductionSummaryNet${idx}`).textContent = formatNumber(eff.netPay) + '원';

        [`deductionPension${idx}`, `deductionEmployment${idx}`, `deductionSummaryTotal${idx}`, `deductionSummaryNet${idx}`].forEach(id => {
            document.getElementById(id).classList.toggle('value-changed', applied);
        });
        setMwCapNotice('deduction', idx, applied, eff.pensionCapped, eff.employmentCapped);
    } else {
        const eff = getEffectiveEmployerShare(idx);

        document.getElementById(`burdenPension${idx}`).textContent = formatNumber(eff.pension) + '원';
        document.getElementById(`burdenEmployment${idx}`).textContent = formatNumber(eff.employment) + '원';
        document.getElementById(`burdenSummaryTotal${idx}`).textContent = formatNumber(eff.total) + '원';

        [`burdenPension${idx}`, `burdenEmployment${idx}`, `burdenSummaryTotal${idx}`].forEach(id => {
            document.getElementById(id).classList.toggle('value-changed', applied);
        });
        setMwCapNotice('burden', idx, applied, eff.pensionCapped, eff.employmentCapped);
    }
}

// 근로자 여러명 카드의 상한액 적용 안내 문구를 보이거나 숨김 (토글 끄면 항상 숨김)
function setMwCapNotice(type, key, applied, pensionCapped, employmentCapped) {
    const el = document.getElementById(`${type}DurunuriCapNote${key}`);
    if (!el) return;
    const text = applied ? durunuriCapNoticeText(pensionCapped, employmentCapped) : '';
    el.textContent = text;
    el.style.display = text ? '' : 'none';
}

// 근로자별 소소 노트 (나이 예외 / 두루누리 대상 여부) 문구 생성
// includeDurunuri: 사업주 본인은 두루누리 지원 대상이 아니므로 false로 호출해서 제외함
function shareNotes(share, workerSalary, includeDurunuri = true) {
    const notes = [];
    if (share.pensionExempt) notes.push('국민연금 면제');
    if (share.employmentExempt) notes.push('고용보험 면제');
    if (share.pensionExemptNextMonth) notes.push('다음달 국민연금 면제 예정');
    if (share.employmentExemptNextMonth) notes.push('다음달 고용보험 면제 예정');
    if (includeDurunuri && workerSalary <= 2700000) notes.push('두루누리 지원 가능');
    return notes.join(' · ');
}

// 근로자 여러명 결과 — 한 사람(근로자 또는 사업주 본인)의 "공제" 카드 HTML 생성 (key는 숫자 idx 또는 'owner')
function buildDeductionItemHTML(key, label, salary, s) {
    const notes = shareNotes(s, salary);
    const eligible = salary <= 2700000;
    return `
        <div class="mw-result-item">
            <div class="mw-result-item-clickable" onclick="toggleMwDetail('deduction', '${key}')">
                <div class="mw-result-item-head">
                    <span>${label}</span>
                    <span class="mw-toggle-icon" id="deductionIcon${key}">자세히 ▾</span>
                </div>
                <div class="mw-result-item-body">
                    <span>공제 <span id="deductionSummaryTotal${key}">${formatNumber(s.total)}원</span></span>
                    <span>실수령 <span id="deductionSummaryNet${key}">${formatNumber(s.netPay)}원</span></span>
                </div>
                ${notes ? `<div class="mw-result-item-note">ℹ️ ${notes}</div>` : ''}
            </div>
            <div class="mw-result-detail" id="deductionDetail${key}">
                <div class="mw-result-detail-inner">
                    <div class="result-row"><span>국민연금<span class="rate-tag">${s.pensionExempt ? '(면제)' : formatRate(RATES.pension / 2 * 100)}</span></span><span id="deductionPension${key}">${formatNumber(s.pension)}원</span></div>
                    <div class="result-row"><span>건강보험<span class="rate-tag">${formatRate(RATES.health / 2 * 100)}</span></span><span>${formatNumber(s.health)}원</span></div>
                    <div class="result-row"><span>장기요양보험<span class="rate-tag">(건강보험료 × ${roundRate(RATES.longterm * 100)}%)</span></span><span>${formatNumber(s.longterm)}원</span></div>
                    <div class="result-row"><span>고용보험<span class="rate-tag">${s.employmentExempt ? '(면제)' : formatRate(RATES.employmentWorker * 100)}</span></span><span id="deductionEmployment${key}">${formatNumber(s.employment)}원</span></div>
                    ${eligible ? `<button class="mw-durunuri-btn" id="deductionDurunuriBtn${key}" onclick="toggleMwDurunuri('deduction', '${key}')">두루누리 지원받으면 얼마?</button>
                    <p class="mw-owner-note" id="deductionDurunuriCapNote${key}" style="display:none;"></p>` : ''}
                </div>
            </div>
        </div>
    `;
}

// "근로자 월급에서 얼마 공제하나요?" 탭 내용 생성
function renderDeductionContent(workersCalc) {
    let sumPension = 0, sumHealth = 0, sumLongterm = 0, sumEmployment = 0, sumTotal = 0;
    let itemsHTML = '';

    workersCalc.forEach((w, idx) => {
        const s = w.workerShare;
        sumPension += s.pension;
        sumHealth += s.health;
        sumLongterm += s.longterm;
        sumEmployment += s.employment;
        sumTotal += s.total;

        const label = `근로자 ${idx + 1}<span class="mw-result-item-salary"> (월급여 ${formatNumber(w.salary)}원)</span>`;
        itemsHTML += buildDeductionItemHTML(idx, label, w.salary, s);
    });

    const anyExempt = workersCalc.some(w =>
        w.workerShare.pensionExempt || w.workerShare.employmentExempt ||
        w.workerShare.pensionExemptNextMonth || w.workerShare.employmentExemptNextMonth
    );

    return `
        <div class="result-row total">
            <span>근로자 전체 공제액 합계</span>
            <span>${formatNumber(sumTotal)}원</span>
        </div>
        <div class="result-table">
            <div class="result-row"><span>국민연금 합계<span class="rate-tag">${formatRate(RATES.pension / 2 * 100)}</span></span><span>${formatNumber(sumPension)}원</span></div>
            <div class="result-row"><span>건강보험 합계<span class="rate-tag">${formatRate(RATES.health / 2 * 100)}</span></span><span>${formatNumber(sumHealth)}원</span></div>
            <div class="result-row"><span>장기요양보험 합계<span class="rate-tag">(건강보험료 × ${roundRate(RATES.longterm * 100)}%)</span></span><span>${formatNumber(sumLongterm)}원</span></div>
            <div class="result-row"><span>고용보험 합계<span class="rate-tag">${formatRate(RATES.employmentWorker * 100)}</span></span><span>${formatNumber(sumEmployment)}원</span></div>
        </div>
        ${anyExempt ? '<p class="privacy-note">ℹ️ 위 요율은 기본 요율이에요. 나이(60세/65세) 조건으로 면제된 근로자가 있어 실제 합계에는 이미 반영되어 있습니다.</p>' : ''}
        <div class="mw-result-list">${itemsHTML}</div>
        <p class="privacy-note">ℹ️ 급여 270만원 이하 근로자는 두루누리 지원 가능 대상이에요 (취득 전 1년간 고용보험 가입 이력이 없는 등 추가 조건 있음 — 대상이 되면 보험료의 80%를 지원받을 수 있어요). 정확한 대상 여부는 <a href="https://insurancesupport.or.kr/durunuri/intro.php" target="_blank" rel="noopener noreferrer">두루누리 안내 페이지</a>에서 확인해주세요.</p>
    `;
}

// 근로자 여러명 결과 — 근로자 1명의 "사업주 부담" 카드 HTML 생성 (사업주 본인은 buildOwnerBurdenItemHTML이 따로 담당)
function buildBurdenItemHTML(key, label, salary, s) {
    const notes = shareNotes(s, salary);
    const eligible = salary <= 2700000;
    return `
        <div class="mw-result-item">
            <div class="mw-result-item-clickable" onclick="toggleMwDetail('burden', '${key}')">
                <div class="mw-result-item-head">
                    <span>${label}</span>
                    <span class="mw-toggle-icon" id="burdenIcon${key}">자세히 ▾</span>
                </div>
                <div class="mw-result-item-body">
                    <span>사업주 부담 <span id="burdenSummaryTotal${key}">${formatNumber(s.total)}원</span></span>
                </div>
                ${notes ? `<div class="mw-result-item-note">ℹ️ ${notes}</div>` : ''}
            </div>
            <div class="mw-result-detail" id="burdenDetail${key}">
                <div class="mw-result-detail-inner">
                    <div class="result-row"><span>국민연금<span class="rate-tag">${s.pensionExempt ? '(면제)' : formatRate(RATES.pension / 2 * 100)}</span></span><span id="burdenPension${key}">${formatNumber(s.pensionEmployer)}원</span></div>
                    <div class="result-row"><span>건강보험<span class="rate-tag">${formatRate(RATES.health / 2 * 100)}</span></span><span>${formatNumber(s.healthEmployer)}원</span></div>
                    <div class="result-row"><span>장기요양보험<span class="rate-tag">(건강보험료 × ${roundRate(RATES.longterm * 100)}%)</span></span><span>${formatNumber(s.longtermEmployer)}원</span></div>
                    <div class="result-row"><span>고용보험<span class="rate-tag">${formatRate(s.employmentEmployerRate * 100)}</span></span><span id="burdenEmployment${key}">${formatNumber(s.employmentEmployer)}원</span></div>
                    <div class="result-row"><span>산재보험<span class="rate-tag">${s.accidentPermille === null ? '' : formatRate(s.accidentPermille / 10)}</span></span><span>${s.accidentEmployer === null ? '업종을 선택해주세요' : formatNumber(s.accidentEmployer) + '원'}</span></div>
                    ${eligible ? `<button class="mw-durunuri-btn" id="burdenDurunuriBtn${key}" onclick="toggleMwDurunuri('burden', '${key}')">두루누리 지원받으면 얼마?</button>
                    <p class="mw-owner-note" id="burdenDurunuriCapNote${key}" style="display:none;"></p>` : ''}
                </div>
            </div>
        </div>
    `;
}

// 사업주 본인 카드 HTML 생성 — 근로자와 달리 고용보험·산재보험 항목이 아예 없음 (가입 대상이 아니라서)
function buildOwnerBurdenItemHTML(salary, s) {
    const notes = shareNotes(s, salary, false);
    return `
        <div class="mw-result-item">
            <div class="mw-result-item-clickable" onclick="toggleMwDetail('burden', 'owner')">
                <div class="mw-result-item-head">
                    <span>사업주 본인<span class="mw-result-item-salary"> (기준급여 ${formatNumber(salary)}원)</span></span>
                    <span class="mw-toggle-icon" id="burdenIconowner">자세히 ▾</span>
                </div>
                <div class="mw-result-item-body">
                    <span>사업주 본인 부담 <span id="burdenSummaryTotalowner">${formatNumber(s.total)}원</span></span>
                </div>
                ${notes ? `<div class="mw-result-item-note">ℹ️ ${notes}</div>` : ''}
            </div>
            <div class="mw-result-detail" id="burdenDetailowner">
                <div class="mw-result-detail-inner">
                    <div class="result-row"><span>국민연금<span class="rate-tag">${s.pensionExempt ? '(면제)' : formatRate(RATES.pension * 100)}</span></span><span id="burdenPensionowner">${formatNumber(s.pensionEmployer)}원</span></div>
                    <div class="result-row"><span>건강보험<span class="rate-tag">${formatRate(RATES.health * 100)}</span></span><span>${formatNumber(s.healthEmployer)}원</span></div>
                    <div class="result-row"><span>장기요양보험<span class="rate-tag">(건강보험료 × ${roundRate(RATES.longterm * 100)}%)</span></span><span>${formatNumber(s.longtermEmployer)}원</span></div>
                    <p class="mw-owner-note">ℹ️ 사업주는 고용산재보험 대상이 아니며, 두루누리 지원 대상도 아닙니다.</p>
                </div>
            </div>
        </div>
    `;
}

// "사업주는 얼마 부담해야 하나요?" 탭 내용 생성
function renderBurdenContent(workersCalc, owner) {
    let sumPension = 0, sumHealth = 0, sumLongterm = 0, sumEmployment = 0, sumAccident = 0, sumTotal = 0;
    let itemsHTML = '';

    workersCalc.forEach((w, idx) => {
        const s = w.employerShare;
        sumPension += s.pensionEmployer;
        sumHealth += s.healthEmployer;
        sumLongterm += s.longtermEmployer;
        sumEmployment += s.employmentEmployer;
        sumAccident += (s.accidentEmployer || 0);
        sumTotal += s.total;

        const label = `근로자 ${idx + 1}<span class="mw-result-item-salary"> (월급여 ${formatNumber(w.salary)}원)</span>`;
        itemsHTML += buildBurdenItemHTML(idx, label, w.salary, s);
    });

    const anyExempt = workersCalc.some(w =>
        w.employerShare.pensionExempt || w.employerShare.employmentExempt ||
        w.employerShare.pensionExemptNextMonth || w.employerShare.employmentExemptNextMonth
    ) || (owner && (owner.ownerShare.pensionExempt || owner.ownerShare.pensionExemptNextMonth));
    const accidentPermille = workersCalc.length > 0 ? workersCalc[0].employerShare.accidentPermille : null;

    const ownerHTML = owner ? `
        <div class="mw-owner-section">
            <div class="mw-owner-label">사업주 본인 (아래 합계 중 국민연금·건강보험·장기요양에만 포함됨)</div>
            ${buildOwnerBurdenItemHTML(owner.salary, owner.ownerShare)}
        </div>
    ` : '';

    // 사업주 본인의 국민연금·건강보험·장기요양은 "사업주 부담 합계"에 포함시킴 (고용·산재는 대상이 아니라서 애초에 없음)
    if (owner) {
        sumPension += owner.ownerShare.pensionEmployer;
        sumHealth += owner.ownerShare.healthEmployer;
        sumLongterm += owner.ownerShare.longtermEmployer;
        sumTotal += owner.ownerShare.total;
    }

    return `
        <div class="result-row total">
            <span>사업주 부담 보험료 합계</span>
            <span>${formatNumber(sumTotal)}원</span>
        </div>
        <div class="result-table">
            <div class="result-row"><span>국민연금 합계<span class="rate-tag">${formatRate(RATES.pension / 2 * 100)}</span></span><span>${formatNumber(sumPension)}원</span></div>
            <div class="result-row"><span>건강보험 합계<span class="rate-tag">${formatRate(RATES.health / 2 * 100)}</span></span><span>${formatNumber(sumHealth)}원</span></div>
            <div class="result-row"><span>장기요양보험 합계<span class="rate-tag">(건강보험료 × ${roundRate(RATES.longterm * 100)}%)</span></span><span>${formatNumber(sumLongterm)}원</span></div>
            <div class="result-row"><span>고용보험 합계<span class="rate-tag rate-tag-long">(실업급여 ${roundRate(RATES.employmentWorker * 100)}% + 고용안정 ${roundRate(RATES.employmentStability * 100)}%, 65세 이상은 고용안정분만)</span></span><span>${formatNumber(sumEmployment)}원</span></div>
            <div class="result-row"><span>산재보험 합계<span class="rate-tag">${accidentPermille === null ? '' : formatRate(accidentPermille / 10)}</span></span><span>${formatNumber(sumAccident)}원</span></div>
        </div>
        ${anyExempt ? '<p class="privacy-note">ℹ️ 위 요율은 기본 요율이에요. 나이(60세/65세) 조건으로 면제된 근로자가 있어 실제 합계에는 이미 반영되어 있습니다.</p>' : ''}
        ${ownerHTML}
        <div class="mw-result-list">${itemsHTML}</div>
        <p class="privacy-note">ℹ️ 급여 270만원 이하 근로자는 국민연금·고용보험 사업주 부담분도 두루누리 지원 가능 대상이에요 (취득 전 1년간 고용보험 가입 이력이 없는 등 추가 조건 있음 — 대상이 되면 보험료의 80%를 지원받을 수 있어요). 정확한 대상 여부는 <a href="https://insurancesupport.or.kr/durunuri/intro.php" target="_blank" rel="noopener noreferrer">두루누리 안내 페이지</a>에서 확인해주세요.</p>
    `;
}

// 여러 근로자를 한번에 계산 — 각 줄마다 computeWorkerShare/computeEmployerShare를 호출해
// "근로자 공제분" / "사업주 부담분" 두 탭에 나눠서 채워넣음
function calculateEmployerAll() {
    const rows = document.querySelectorAll('#multiWorkerRows .multi-worker-row');
    const industryIdx = document.getElementById('multiIndustryType').value;
    const errorEl = document.getElementById('employerInputError');
    const tabsBox = document.getElementById('employerResultTabs');
    const buttonRow = document.getElementById('employerButtonRow');

    const workers = [];
    let hasError = false;

    rows.forEach(row => {
        const birthRaw = row.querySelector('.mw-birth').value.trim();
        const salaryRaw = row.querySelector('.mw-salary').value.trim();

        if (!birthRaw && !salaryRaw) {
            row.classList.remove('mw-row-error');
            return; // 완전히 빈 줄은 건너뜀
        }

        const workerSalary = parseMoney(salaryRaw);
        const bd = parseBirthdate(birthRaw);

        if (!bd || !workerSalary || workerSalary <= 0) {
            row.classList.add('mw-row-error');
            hasError = true;
            return;
        }

        row.classList.remove('mw-row-error');
        workers.push({ salary: workerSalary, birthDate: bd });
    });

    if (hasError) {
        errorEl.textContent = '⚠️ 빨간색으로 표시된 줄의 생년월(6자리)과 급여를 확인해주세요.';
        errorEl.style.display = 'block';
        tabsBox.style.display = 'none';
        buttonRow.style.display = 'none';
        return;
    }

    // 사업주 본인 보험료 — 체크박스를 선택했을 때만 입력값을 읽어서 계산 (선택 사항)
    const includeOwner = document.getElementById('includeOwnerCheckbox').checked;
    let newOwnerCalc = null;

    if (includeOwner) {
        const ownerBirthRaw = document.getElementById('ownerBirth').value.trim();
        const ownerSalaryRaw = document.getElementById('ownerSalary').value.trim();
        const ownerBd = parseBirthdate(ownerBirthRaw);
        const ownerSalaryVal = parseMoney(ownerSalaryRaw);

        if (!ownerBd || !ownerSalaryVal || ownerSalaryVal <= 0) {
            errorEl.textContent = '⚠️ 사업주 본인의 생년월(6자리)과 기준급여를 올바르게 입력해주세요.';
            errorEl.style.display = 'block';
            tabsBox.style.display = 'none';
            buttonRow.style.display = 'none';
            return;
        }

        newOwnerCalc = {
            salary: ownerSalaryVal,
            birthDate: ownerBd,
            ownerShare: computeOwnerShare(ownerSalaryVal, ownerBd)
        };
    }

    if (workers.length === 0 && !includeOwner) {
        errorEl.textContent = '⚠️ 근로자 정보를 최소 1명 이상 입력하거나, 사업주 본인 보험료를 선택해주세요.';
        errorEl.style.display = 'block';
        tabsBox.style.display = 'none';
        buttonRow.style.display = 'none';
        return;
    }

    errorEl.style.display = 'none';

    employerWorkersCalc = workers.map(w => ({
        salary: w.salary,
        birthDate: w.birthDate,
        workerShare: computeWorkerShare(w.salary, w.birthDate),
        employerShare: computeEmployerShare(w.salary, w.birthDate, industryIdx)
    }));
    employerIndustryIdx = industryIdx;
    ownerCalc = newOwnerCalc;
    mwDurunuriApplied = { deduction: {}, burden: {} };

    document.getElementById('deductionResultContent').innerHTML = renderDeductionContent(employerWorkersCalc);
    document.getElementById('burdenResultContent').innerHTML = renderBurdenContent(employerWorkersCalc, ownerCalc);

    tabsBox.style.display = 'block';
    buttonRow.style.display = 'flex';
}

// 근로자(단일) 계산 결과를 PDF로 저장 (브라우저 인쇄 기능 이용 — 서버 저장 없이 그대로 로컬에 저장됨)
// ---- PDF 공통 부품 ----

function prDateStr(date) {
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

function prHeadHTML(title, metaLines) {
    return `
        <div class="pr-head">
            <div>
                <div class="pr-kicker">4대보험 계산 결과</div>
                <h1 class="pr-title">${title}</h1>
            </div>
            <div class="pr-meta">${metaLines.map(line => `<span>${line}</span>`).join('')}</div>
        </div>`;
}

// items: [[항목명, 금액], ...]
function prCardHTML(label, total, items, isDurunuri) {
    return `
        <div class="pr-card${isDurunuri ? ' dn' : ''}">
            <div class="pr-card-label">${label}</div>
            <div class="pr-card-total">${formatNumber(total)}<small>원</small></div>
            <div class="pr-card-list">${items.map(([name, value]) => `<span>${name}</span><span>${formatNumber(value)}</span>`).join('')}</div>
        </div>`;
}

function prNotesHTML(lines) {
    return `<div class="pr-notes">${lines.filter(Boolean).map(line => `<p>※ ${line}</p>`).join('')}</div>`;
}

function prPct(percentValue) {
    return `${roundRate(percentValue)}%`;
}

function prDeductionHeadHTML() {
    return `
        <thead><tr>
            <th>대상</th>
            <th>국민연금<span class="pr-rate">${prPct(RATES.pension / 2 * 100)}</span></th>
            <th>건강보험<span class="pr-rate">${prPct(RATES.health / 2 * 100)}</span></th>
            <th>장기요양<span class="pr-rate">건강×${prPct(RATES.longterm * 100)}</span></th>
            <th>고용보험<span class="pr-rate">${prPct(RATES.employmentWorker * 100)}</span></th>
            <th>공제 합계</th>
            <th>실수령액</th>
        </tr></thead>`;
}

function prBurdenHeadHTML(industry) {
    return `
        <thead><tr>
            <th>대상</th>
            <th>국민연금<span class="pr-rate">${prPct(RATES.pension / 2 * 100)}</span></th>
            <th>건강보험<span class="pr-rate">${prPct(RATES.health / 2 * 100)}</span></th>
            <th>장기요양<span class="pr-rate">건강×${prPct(RATES.longterm * 100)}</span></th>
            <th>고용보험<span class="pr-rate">${prPct(RATES.employmentWorker * 100)}+${prPct(RATES.employmentStability * 100)}</span></th>
            <th>산재보험<span class="pr-rate">${industry ? prPct(industry.permille / 10) : '업종 미선택'}</span></th>
            <th>부담 합계</th>
        </tr></thead>`;
}

// 합계 줄 + (두루누리 대상이 있으면) 바로 아래 두루누리 합계 줄. values/dnValues는 숫자 배열, accentIdx는 빨간색으로 강조할 칸
function prSumRowsHTML(values, dnValues, accentIdx) {
    const cells = values.map((v, i) => `<td${i === accentIdx ? ' class="pr-accent"' : ''}>${formatNumber(v)}</td>`).join('');
    let html = `<tr class="pr-sum${dnValues ? ' pr-has-dn' : ''}"><th>합계</th>${cells}</tr>`;
    if (dnValues) {
        html += `<tr class="pr-dn pr-sum-dn"><th>두루누리 적용 시</th>${dnValues.map(v => `<td>${formatNumber(v)}</td>`).join('')}</tr>`;
    }
    return html;
}

function prWhoHTML(name, sub) {
    return `${name}<span class="pr-who">${sub}</span>`;
}

function prDurunuriCapNote(anyCapped) {
    return anyCapped
        ? `"(상한)" 표시는 월급여가 높아 지원금이 상한액(국민연금 ${formatNumber(DURUNURI_CAPS.pension)}원, 고용보험 ${formatNumber(DURUNURI_CAPS.employmentWorker)}원)까지만 적용된 경우입니다.`
        : '';
}

// 근로자(단일) 계산 결과를 PDF로 저장
function printResult(type) {
    if (type !== 'worker') return;
    lastPdfRender = () => printResult(type);

    const printArea = document.getElementById('printArea');
    const today = new Date();

    // 두루누리 지원 가능 대상이면(급여 270만원 이하) 화면 토글 상태와 무관하게 적용 시 금액도 함께 보여줌
    const dd = pdfShowDurunuri && salary <= 2700000 ? computeDurunuriDeduction(calc, salary) : null;
    const anyCapped = dd && (dd.pensionCapped || dd.employmentCapped);
    const cap = capped => capped ? '<span class="pr-dn-cap"> (상한)</span>' : '';
    const dnCell = (value, capped) => dd ? `<td class="pr-dn-col">${formatNumber(value)}${cap(capped)}</td>` : '';

    const rows = [
        ['국민연금', calc.pensionExempt ? '면제' : prPct(RATES.pension / 2 * 100), calc.pension, dd && dd.pension, dd && dd.pensionCapped],
        ['건강보험', prPct(RATES.health / 2 * 100), calc.health, dd && dd.health, false],
        ['장기요양보험', `건강보험료의 ${prPct(RATES.longterm * 100)}`, calc.longterm, dd && dd.longterm, false],
        ['고용보험', calc.employmentExempt ? '면제' : prPct(RATES.employmentWorker * 100), calc.employment, dd && dd.employment, dd && dd.employmentCapped],
    ];

    printArea.innerHTML = `
        ${prHeadHTML('근로자 4대보험 공제 내역', [`${prDateStr(today)} 기준`, '금액 단위: 원'])}

        <section class="pr-keys">
            <div class="pr-key"><div class="pr-key-label">월급여</div><div class="pr-key-value">${formatNumber(salary)}<small>원</small></div></div>
            <div class="pr-key"><div class="pr-key-label">공제 합계</div><div class="pr-key-value pr-accent">${formatNumber(calc.total)}<small>원</small></div></div>
            <div class="pr-key"><div class="pr-key-label">실수령액</div><div class="pr-key-value">${formatNumber(calc.netPay)}<small>원</small></div></div>
        </section>

        <h2 class="pr-h2">월급에서 공제하는 금액</h2>
        <table class="pr-table">
            <thead><tr>
                <th>항목</th>
                <th>공제액</th>
                ${dd ? '<th class="pr-dn-col">두루누리 적용 시</th>' : ''}
            </tr></thead>
            <tbody>
                ${rows.map(([name, rate, value, dnValue, capped]) => `
                <tr>
                    <td>${name}<span class="pr-rate">${rate}</span></td>
                    <td>${formatNumber(value)}</td>
                    ${dnCell(dnValue, capped)}
                </tr>`).join('')}
                <tr class="pr-sum">
                    <th>공제 합계</th>
                    <td class="pr-accent">${formatNumber(calc.total)}</td>
                    ${dd ? `<td class="pr-dn-col">${formatNumber(dd.total)}</td>` : ''}
                </tr>
                <tr>
                    <td class="pr-strong">실수령액</td>
                    <td class="pr-strong">${formatNumber(calc.netPay)}</td>
                    ${dd ? `<td class="pr-dn-col pr-strong">${formatNumber(dd.netPay)}</td>` : ''}
                </tr>
            </tbody>
        </table>

        ${prNotesHTML([
            '이 계산 결과는 참고용이며, 실제 공제 금액은 담당 기관 확인에 따라 달라질 수 있습니다.',
            '각 보험료는 10원 미만을 절사했습니다.',
            calc.pensionExempt ? '만 60세가 지나 국민연금은 공제 대상에서 제외했습니다.' : '',
            calc.employmentExempt ? '만 65세가 지나 고용보험(실업급여)은 공제 대상에서 제외했습니다.' : '',
            calc.pensionExemptNextMonth ? '다음 달부터 만 60세가 되어 국민연금이 제외됩니다.' : '',
            calc.employmentExemptNextMonth ? '다음 달부터 만 65세가 되어 고용보험(실업급여)이 제외됩니다.' : '',
            dd ? '두루누리 적용 시 금액은 월급여 270만원 이하로 지원 가능 대상일 때의 예상 금액입니다.' : '',
            dd ? '두루누리 지원은 국민연금·고용보험에만 적용되며, 실제 지원 여부는 근로복지공단 확인이 필요합니다.' : '',
            prDurunuriCapNote(anyCapped),
        ])}
    `;

    showPdfPreview(`4대보험_내월급_${salary}원_${dateSlug(today)}`);
}

// 사업주 경로(근로자 여러명) 계산 결과를 PDF로 저장 — 근로자 공제분/사업주 부담분 표를 함께 출력
// PDF용 표 한 줄(근로자 또는 사업주 본인) 생성 — 두루누리 대상이면 바로 아래에 적용 시 금액 줄도 같이 만듦
function buildPrintRowPair(label, salary, d, b) {
    const eligible = pdfShowDurunuri && hasDurunuri(salary, d);
    const rowClass = eligible ? ' class="pr-has-dn"' : '';
    const accidentCell = value => b.accidentEmployer === null
        ? '<td class="pr-na">업종 미선택</td>'
        : `<td>${formatNumber(value)}</td>`;

    let deductionRow = `
        <tr${rowClass}>
            <td>${label}</td>
            <td>${formatNumber(d.pension)}</td>
            <td>${formatNumber(d.health)}</td>
            <td>${formatNumber(d.longterm)}</td>
            <td>${formatNumber(d.employment)}</td>
            <td class="pr-strong">${formatNumber(d.total)}</td>
            <td>${formatNumber(d.netPay)}</td>
        </tr>`;
    let burdenRow = `
        <tr${rowClass}>
            <td>${label}</td>
            <td>${formatNumber(b.pensionEmployer)}</td>
            <td>${formatNumber(b.healthEmployer)}</td>
            <td>${formatNumber(b.longtermEmployer)}</td>
            <td>${formatNumber(b.employmentEmployer)}</td>
            ${accidentCell(b.accidentEmployer)}
            <td class="pr-strong">${formatNumber(b.total)}</td>
        </tr>`;

    // 두루누리 지원이 반영됐을 때의 "이 사람 몫" — 대상이 아니면(급여 270만원 초과)
    // 원래 금액 그대로, 대상이면 지원 적용된 금액. effDeduction/effBurden은 표별
    // 합계 줄(두루누리 적용 시)에, effPension 등 합친 값은 총 부과 금액 집계에 씀
    let capped = false;
    let effDeduction = { pension: d.pension, health: d.health, longterm: d.longterm, employment: d.employment, total: d.total, netPay: d.netPay };
    let effBurden = { pension: b.pensionEmployer, health: b.healthEmployer, longterm: b.longtermEmployer, employment: b.employmentEmployer, accident: b.accidentEmployer || 0, total: b.total };

    if (eligible) {
        const dd = computeDurunuriDeduction(d, salary);
        const bb = computeDurunuriBurden(b);
        const ddCapped = dd.pensionCapped || dd.employmentCapped;
        const bbCapped = bb.pensionCapped || bb.employmentCapped;
        capped = ddCapped || bbCapped;
        const dnLabel = isCapped => `두루누리 적용${isCapped ? '<span class="pr-dn-cap"> (상한)</span>' : ''}`;

        deductionRow += `
            <tr class="pr-dn">
                <td>${dnLabel(ddCapped)}</td>
                <td>${formatNumber(dd.pension)}</td>
                <td>${formatNumber(dd.health)}</td>
                <td>${formatNumber(dd.longterm)}</td>
                <td>${formatNumber(dd.employment)}</td>
                <td class="pr-strong">${formatNumber(dd.total)}</td>
                <td>${formatNumber(dd.netPay)}</td>
            </tr>`;
        burdenRow += `
            <tr class="pr-dn">
                <td>${dnLabel(bbCapped)}</td>
                <td>${formatNumber(bb.pension)}</td>
                <td>${formatNumber(bb.health)}</td>
                <td>${formatNumber(bb.longterm)}</td>
                <td>${formatNumber(bb.employment)}</td>
                ${accidentCell(bb.accident)}
                <td class="pr-strong">${formatNumber(bb.total)}</td>
            </tr>`;

        effDeduction = dd;
        effBurden = bb;
    }

    const effPension = effDeduction.pension + effBurden.pension;
    const effHealth = effDeduction.health + effBurden.health;
    const effLongterm = effDeduction.longterm + effBurden.longterm;
    const effEmployment = effDeduction.employment + effBurden.employment;
    const effAccident = effBurden.accident || 0;

    return { deductionRow, burdenRow, capped, effDeduction, effBurden, effPension, effHealth, effLongterm, effEmployment, effAccident };
}

function printEmployerAll() {
    if (employerWorkersCalc.length === 0 && !ownerCalc) return;
    lastPdfRender = printEmployerAll;

    const printArea = document.getElementById('printArea');
    const today = new Date();

    const industry = employerIndustryIdx !== '' ? INDUSTRY_RATES[parseInt(employerIndustryIdx, 10)] : null;

    let deductionRows = '';
    let burdenRows = '';
    // 합계 [국민연금, 건강보험, 장기요양, 고용보험, 공제합계, 실수령액] / [국민연금, 건강보험, 장기요양, 고용보험, 산재보험, 부담합계]
    const sumD = [0, 0, 0, 0, 0, 0], effD = [0, 0, 0, 0, 0, 0];
    const sumB = [0, 0, 0, 0, 0, 0], effB = [0, 0, 0, 0, 0, 0];
    const addTo = (arr, values) => values.forEach((v, i) => { arr[i] += v; });
    let anyDurunuriCapped = false;

    employerWorkersCalc.forEach((w, idx) => {
        const d = w.workerShare;
        const b = w.employerShare;

        addTo(sumD, [d.pension, d.health, d.longterm, d.employment, d.total, d.netPay]);
        addTo(sumB, [b.pensionEmployer, b.healthEmployer, b.longtermEmployer, b.employmentEmployer, b.accidentEmployer || 0, b.total]);

        const r = buildPrintRowPair(prWhoHTML(`근로자 ${idx + 1}`, `월 ${formatNumber(w.salary)}`), w.salary, d, b);
        deductionRows += r.deductionRow;
        burdenRows += r.burdenRow;
        if (r.capped) anyDurunuriCapped = true;

        addTo(effD, [r.effDeduction.pension, r.effDeduction.health, r.effDeduction.longterm, r.effDeduction.employment, r.effDeduction.total, r.effDeduction.netPay]);
        addTo(effB, [r.effBurden.pension, r.effBurden.health, r.effBurden.longterm, r.effBurden.employment, r.effBurden.accident || 0, r.effBurden.total]);
    });

    // 사업주 본인은 "근로자 공제" 표에는 안 넣고 "사업주 부담" 표에만 넣음 (두루누리 대상이 아니라 적용 시 합계에도 원래 금액 그대로)
    if (ownerCalc) {
        const os = ownerCalc.ownerShare;
        burdenRows += `
            <tr>
                <td>${prWhoHTML('사업주 본인', `월 ${formatNumber(ownerCalc.salary)}`)}</td>
                <td>${formatNumber(os.pensionEmployer)}</td>
                <td>${formatNumber(os.healthEmployer)}</td>
                <td>${formatNumber(os.longtermEmployer)}</td>
                <td class="pr-na">해당없음</td>
                <td class="pr-na">해당없음</td>
                <td class="pr-strong">${formatNumber(os.total)}</td>
            </tr>`;
        const ownerValues = [os.pensionEmployer, os.healthEmployer, os.longtermEmployer, 0, 0, os.total];
        addTo(sumB, ownerValues);
        addTo(effB, ownerValues);
    }

    const anyEligible = pdfShowDurunuri && employerWorkersCalc.some(w => hasDurunuri(w.salary, w.workerShare));
    const anyExempt = employerWorkersCalc.some(w =>
        w.workerShare.pensionExempt || w.workerShare.employmentExempt ||
        w.workerShare.pensionExemptNextMonth || w.workerShare.employmentExemptNextMonth
    ) || (ownerCalc && (ownerCalc.ownerShare.pensionExempt || ownerCalc.ownerShare.pensionExemptNextMonth));
    const burdenItems = arr => [['국민연금', arr[0]], ['건강보험', arr[1]], ['장기요양보험', arr[2]], ['고용보험', arr[3]], ['산재보험', arr[4]]];

    printArea.innerHTML = `
        ${prHeadHTML('사업주 4대보험 부담 내역', [
            `${prDateStr(today)} 기준`,
            `업종: ${industry ? `${industry.name} · 산재 ${industry.permille}/1000` : '선택 안 함'}`,
            '금액 단위: 원',
        ])}

        <section class="pr-cards">
            ${prCardHTML('사업주 부담 합계', sumB[5], burdenItems(sumB), false)}
            ${anyEligible ? prCardHTML('두루누리 적용 시', effB[5], burdenItems(effB), true) : ''}
        </section>

        <h2 class="pr-h2">근로자 공제 내역 <span>· 근로자 월급에서 공제하는 금액</span></h2>
        <table class="pr-table">
            ${prDeductionHeadHTML()}
            <tbody>
                ${deductionRows}
                ${prSumRowsHTML(sumD, anyEligible ? effD : null, 4)}
            </tbody>
        </table>

        <h2 class="pr-h2">사업주 부담 내역 <span>· 사업주가 내는 금액</span></h2>
        <table class="pr-table">
            ${prBurdenHeadHTML(industry)}
            <tbody>
                ${burdenRows}
                ${prSumRowsHTML(sumB, anyEligible ? effB : null, 5)}
            </tbody>
        </table>

        ${prNotesHTML([
            '이 계산 결과는 참고용이며, 실제 신고·부과 금액은 담당 기관 확인에 따라 달라질 수 있습니다.',
            '표의 요율은 기본 요율이며, 각 보험료는 10원 미만을 절사했습니다.',
            '고용보험은 만 65세 이상이면 사업주 고용안정·직업능력개발분(0.25%)만 부과됩니다.',
            anyExempt ? '나이(만 60세·65세) 조건으로 제외된 항목이 있는 경우, 금액에는 이미 반영되어 있어 표의 기본 요율과 다를 수 있습니다.' : '',
            industry ? '산재보험료는 선택한 업종 요율로 계산한 참고 금액이며, 실제 업종 분류는 근로복지공단이 정합니다.' : '업종을 선택하지 않아 산재보험료는 계산하지 않았습니다.',
            anyEligible ? '두루누리 적용 금액은 월급여 270만원 이하 근로자의 국민연금·고용보험에 지원금을 반영한 참고 금액입니다.' : '',
            anyEligible ? '사업주 고용보험은 실업급여분(0.9%)에만 두루누리가 적용되고, 고용안정·직업능력개발분(0.25%)은 지원 대상이 아닙니다.' : '',
            anyEligible ? '실제 두루누리 지원 여부는 근로복지공단 확인이 필요합니다.' : '',
            prDurunuriCapNote(anyDurunuriCapped),
            ownerCalc ? '사업주 본인은 고용보험·산재보험 가입 대상이 아니며, 국민연금·건강보험은 전액 본인이 부담합니다.' : '',
            !ownerCalc ? ''
                : pdfShowDurunuri ? '사업주 본인 보험료는 사업주 부담 내역에만 포함했고, 두루누리 지원 대상이 아닙니다.'
                : '사업주 본인 보험료는 사업주 부담 내역에만 포함했습니다.',
        ])}
    `;

    showPdfPreview(`4대보험_사업주부담_${dateSlug(today)}`);
}

// 전문가용 "한 달 총 부과 금액"을 PDF로 저장 — 화면에는 항목별 총합만 보이지만,
// PDF에는 근로자별(+사업주 본인) 상세 내역까지 전부 펼쳐서 보여줌
function printTotalBill() {
    if (totalBillWorkersCalc.length === 0 && !totalBillOwnerCalc) return;
    lastPdfRender = printTotalBill;

    const printArea = document.getElementById('printArea');
    const today = new Date();

    const industry = totalBillIndustryIdx !== '' ? INDUSTRY_RATES[parseInt(totalBillIndustryIdx, 10)] : null;

    let deductionRows = '';
    let burdenRows = '';
    let sumDeduction = 0, sumDeductionPension = 0, sumDeductionHealth = 0, sumDeductionLongterm = 0, sumDeductionEmployment = 0, sumNetPay = 0;
    let sumBurden = 0, sumBurdenPension = 0, sumBurdenHealth = 0, sumBurdenLongterm = 0, sumBurdenEmployment = 0, sumBurdenAccident = 0;
    // 두루누리 지원이 반영됐을 때의 총 고지 금액 집계용 (대상 아닌 근로자·사업주 본인은 원래 금액 그대로 더해짐)
    let effPension = 0, effHealth = 0, effLongterm = 0, effEmployment = 0, effAccident = 0;
    // 두루누리 지원이 반영됐을 때의 표별(공제분/부담분) 합계 — 표 안의 "두루누리 적용 시" 합계 줄용
    let effSumDeductionPension = 0, effSumDeductionHealth = 0, effSumDeductionLongterm = 0, effSumDeductionEmployment = 0, effSumDeduction = 0, effSumNetPay = 0;
    let effSumBurdenPension = 0, effSumBurdenHealth = 0, effSumBurdenLongterm = 0, effSumBurdenEmployment = 0, effSumBurdenAccident = 0, effSumBurden = 0;
    let anyDurunuriCapped = false;

    totalBillWorkersCalc.forEach((w, idx) => {
        const d = w.workerShare;
        const b = w.employerShare;

        sumDeduction += d.total;
        sumDeductionPension += d.pension;
        sumDeductionHealth += d.health;
        sumDeductionLongterm += d.longterm;
        sumDeductionEmployment += d.employment;
        sumNetPay += d.netPay;

        sumBurden += b.total;
        sumBurdenPension += b.pensionEmployer;
        sumBurdenHealth += b.healthEmployer;
        sumBurdenLongterm += b.longtermEmployer;
        sumBurdenEmployment += b.employmentEmployer;
        sumBurdenAccident += (b.accidentEmployer || 0);

        const foreignTag = w.foreign ? ` · 외국인 ${w.foreign.visa.code} ${w.foreign.country.name}` : '';
        const result = buildPrintRowPair(prWhoHTML(`근로자 ${idx + 1}`, `월 ${formatNumber(w.salary)}${foreignTag}`), w.salary, d, b);
        deductionRows += result.deductionRow;
        burdenRows += result.burdenRow;
        if (result.capped) anyDurunuriCapped = true;

        effPension += result.effPension;
        effHealth += result.effHealth;
        effLongterm += result.effLongterm;
        effEmployment += result.effEmployment;
        effAccident += result.effAccident;

        effSumDeductionPension += result.effDeduction.pension;
        effSumDeductionHealth += result.effDeduction.health;
        effSumDeductionLongterm += result.effDeduction.longterm;
        effSumDeductionEmployment += result.effDeduction.employment;
        effSumDeduction += result.effDeduction.total;
        effSumNetPay += result.effDeduction.netPay;

        effSumBurdenPension += result.effBurden.pension;
        effSumBurdenHealth += result.effBurden.health;
        effSumBurdenLongterm += result.effBurden.longterm;
        effSumBurdenEmployment += result.effBurden.employment;
        effSumBurdenAccident += (result.effBurden.accident || 0);
        effSumBurden += result.effBurden.total;
    });

    // 사업주 본인 — 유형에 따라 표에 들어가는 자리가 다름
    // 개인사업자: 전액을 "사업주 부담" 표에만 한 줄로. 법인 유보수: 본인 몫은 "근로자 공제" 표에,
    // 법인 몫은 "사업주 부담" 표에 각각 한 줄씩(일반 근로자와 동일한 구조). 무보수: 0원 한 줄만 참고로 표시.
    const os = totalBillOwnerCalc.ownerShare;
    const ownerTypeLabel = { individual: '개인사업자', paidCorp: '법인 대표(유보수)', unpaidCorp: '법인 대표(무보수)' }[totalBillOwnerCalc.ownerType];
    const ownerSalaryLabel = totalBillOwnerCalc.ownerType === 'unpaidCorp' ? '무보수' : `월 ${formatNumber(totalBillOwnerCalc.salary)}`;
    const ownerLabel = prWhoHTML('사업주 본인', `${ownerTypeLabel} · ${ownerSalaryLabel}`);

    if (totalBillOwnerCalc.ownerType === 'paidCorp') {
        const selfTotal = os.selfPension + os.selfHealth + os.selfLongterm;
        deductionRows += `
            <tr>
                <td>${ownerLabel}</td>
                <td>${formatNumber(os.selfPension)}</td>
                <td>${formatNumber(os.selfHealth)}</td>
                <td>${formatNumber(os.selfLongterm)}</td>
                <td class="pr-na">해당없음</td>
                <td class="pr-strong">${formatNumber(selfTotal)}</td>
                <td>${formatNumber(totalBillOwnerCalc.salary - selfTotal)}</td>
            </tr>`;
        sumDeduction += selfTotal;
        sumDeductionPension += os.selfPension;
        sumDeductionHealth += os.selfHealth;
        sumDeductionLongterm += os.selfLongterm;
        sumNetPay += totalBillOwnerCalc.salary - selfTotal;
        // 사업주 본인은 두루누리 대상이 아니라 "두루누리 적용 시" 합계에도 원래 금액 그대로 더함
        effSumDeductionPension += os.selfPension;
        effSumDeductionHealth += os.selfHealth;
        effSumDeductionLongterm += os.selfLongterm;
        effSumDeduction += selfTotal;
        effSumNetPay += totalBillOwnerCalc.salary - selfTotal;

        const companyTotal = os.companyPension + os.companyHealth + os.companyLongterm;
        burdenRows += `
            <tr>
                <td>${ownerLabel}</td>
                <td>${formatNumber(os.companyPension)}</td>
                <td>${formatNumber(os.companyHealth)}</td>
                <td>${formatNumber(os.companyLongterm)}</td>
                <td class="pr-na">해당없음</td>
                <td class="pr-na">해당없음</td>
                <td class="pr-strong">${formatNumber(companyTotal)}</td>
            </tr>`;
        sumBurden += companyTotal;
        sumBurdenPension += os.companyPension;
        sumBurdenHealth += os.companyHealth;
        sumBurdenLongterm += os.companyLongterm;
        effSumBurdenPension += os.companyPension;
        effSumBurdenHealth += os.companyHealth;
        effSumBurdenLongterm += os.companyLongterm;
        effSumBurden += companyTotal;
    } else {
        // 개인사업자(전액) 또는 무보수(0원) — 둘 다 "사업주 부담" 표 한 줄로
        burdenRows += `
            <tr>
                <td>${ownerLabel}</td>
                <td>${formatNumber(os.pension)}</td>
                <td>${formatNumber(os.health)}</td>
                <td>${formatNumber(os.longterm)}</td>
                <td class="pr-na">해당없음</td>
                <td class="pr-na">해당없음</td>
                <td class="pr-strong">${formatNumber(os.total)}</td>
            </tr>`;
        sumBurden += os.total;
        sumBurdenPension += os.pension;
        sumBurdenHealth += os.health;
        sumBurdenLongterm += os.longterm;
        effSumBurdenPension += os.pension;
        effSumBurdenHealth += os.health;
        effSumBurdenLongterm += os.longterm;
        effSumBurden += os.total;
    }

    // 사업주 본인은 어떤 유형이든 두루누리 지원 대상이 아니므로, 원래 금액(os.pension 등,
    // 본인+법인 몫을 합친 전체 금액) 그대로 두루누리 적용 시 집계에도 똑같이 더함
    // (고용·산재보험은 사업주 본인에게 애초에 없는 항목이라 effEmployment/effAccident는 그대로 둠)
    effPension += os.pension;
    effHealth += os.health;
    effLongterm += os.longterm;

    const grandTotal = sumDeductionPension + sumBurdenPension
        + sumDeductionHealth + sumBurdenHealth
        + sumDeductionLongterm + sumBurdenLongterm
        + sumDeductionEmployment + sumBurdenEmployment
        + sumBurdenAccident;
    const grandPension = sumDeductionPension + sumBurdenPension;
    const grandHealth = sumDeductionHealth + sumBurdenHealth;
    const grandLongterm = sumDeductionLongterm + sumBurdenLongterm;
    const grandEmployment = sumDeductionEmployment + sumBurdenEmployment;

    const effGrandTotal = effPension + effHealth + effLongterm + effEmployment + effAccident;
    const anyEligible = pdfShowDurunuri && totalBillWorkersCalc.some(w => hasDurunuri(w.salary, w.workerShare));
    const anyForeign = totalBillWorkersCalc.some(w => w.foreign);
    const anyReciprocal = totalBillWorkersCalc.some(w => w.foreign && w.foreign.visa.employment === 'reciprocal');

    const anyExempt = totalBillWorkersCalc.some(w =>
        w.workerShare.pensionExempt || w.workerShare.employmentExempt ||
        w.workerShare.pensionExemptNextMonth || w.workerShare.employmentExemptNextMonth
    ) || os.pensionExempt || os.pensionExemptNextMonth;
    const ownerDisclaimer = {
        individual: '사업주 본인(개인사업자)은 별도 고용주가 없어 국민연금·건강보험을 전액 본인이 부담하는 것으로 계산했습니다.',
        paidCorp: '사업주 본인(법인 대표, 유보수)은 일반 근로자와 같이 본인·법인이 절반씩 부담하는 것으로 계산했습니다.',
        unpaidCorp: '사업주 본인(법인 대표, 무보수)은 보수가 없어 보험료를 0원으로 계산했습니다.'
    }[totalBillOwnerCalc.ownerType];

    printArea.innerHTML = `
        ${prHeadHTML('한 달 총 부과 금액', [
            `${prDateStr(today)} 기준`,
            `업종: ${industry ? `${industry.name} · 산재 ${industry.permille}/1000` : '선택 안 함'}`,
            '금액 단위: 원',
        ])}

        <section class="pr-cards">
            ${prCardHTML('총 고지 예상 금액', grandTotal, [
                ['국민연금', grandPension], ['건강보험', grandHealth], ['장기요양보험', grandLongterm],
                ['고용보험', grandEmployment], ['산재보험', sumBurdenAccident],
            ], false)}
            ${anyEligible ? prCardHTML('두루누리 적용 시 총액', effGrandTotal, [
                ['국민연금', effPension], ['건강보험', effHealth], ['장기요양보험', effLongterm],
                ['고용보험', effEmployment], ['산재보험', effAccident],
            ], true) : ''}
        </section>
        ${anyEligible ? '<p class="pr-caption">두루누리 적용 시 총액은 월급여 270만원 이하 근로자의 국민연금·고용보험에만 지원금을 반영한 금액입니다.</p>' : ''}

        <h2 class="pr-h2">근로자별 상세 <span>· 공제분(근로자 본인 몫)</span></h2>
        <table class="pr-table">
            ${prDeductionHeadHTML()}
            <tbody>
                ${deductionRows}
                ${prSumRowsHTML(
                    [sumDeductionPension, sumDeductionHealth, sumDeductionLongterm, sumDeductionEmployment, sumDeduction, sumNetPay],
                    anyEligible ? [effSumDeductionPension, effSumDeductionHealth, effSumDeductionLongterm, effSumDeductionEmployment, effSumDeduction, effSumNetPay] : null,
                    4
                )}
            </tbody>
        </table>

        <h2 class="pr-h2">근로자별 상세 <span>· 사업주 부담분</span></h2>
        <table class="pr-table">
            ${prBurdenHeadHTML(industry)}
            <tbody>
                ${burdenRows}
                ${prSumRowsHTML(
                    [sumBurdenPension, sumBurdenHealth, sumBurdenLongterm, sumBurdenEmployment, sumBurdenAccident, sumBurden],
                    anyEligible ? [effSumBurdenPension, effSumBurdenHealth, effSumBurdenLongterm, effSumBurdenEmployment, effSumBurdenAccident, effSumBurden] : null,
                    5
                )}
            </tbody>
        </table>

        ${prNotesHTML([
            '이 계산 결과는 참고용이며, 실제 신고·부과 금액은 담당 기관 확인에 따라 달라질 수 있습니다.',
            pdfShowDurunuri ? '"총 고지 예상 금액"은 두루누리 지원금을 반영하지 않은 금액입니다.' : '',
            anyEligible ? '"두루누리 적용 시" 금액은 대상 근로자의 국민연금·고용보험에 지원금을 반영한 참고 금액이며, 실제 지원 여부는 근로복지공단 확인이 필요합니다.' : '',
            anyEligible ? '사업주 고용보험은 실업급여분(0.9%)에만 두루누리가 적용되고, 고용안정·직업능력개발분(0.25%)은 지원 대상이 아닙니다.' : '',
            prDurunuriCapNote(anyDurunuriCapped),
            '표의 요율은 기본 요율이며, 각 보험료는 10원 미만을 절사했습니다.',
            '고용보험은 만 65세 이상이면 사업주 고용안정·직업능력개발분(0.25%)만 부과됩니다.',
            anyExempt ? '나이(만 60세·65세) 조건으로 제외된 항목이 있는 경우, 금액에는 이미 반영되어 있어 표의 기본 요율과 다를 수 있습니다.' : '',
            industry ? '산재보험료는 선택한 업종 요율로 계산한 참고 금액이며, 실제 업종 분류는 근로복지공단이 정합니다.' : '업종을 선택하지 않아 산재보험료는 계산하지 않았습니다.',
            anyForeign ? '외국인 근로자는 체류자격·국적 판정에 따라 국민연금·고용보험을 계산했습니다(적용 제외·미가입이면 0원).' : '',
            anyForeign && pdfShowDurunuri ? '외국인은 국민연금 두루누리 지원 대상이 아니며, 고용보험 두루누리는 실업급여에 가입한 경우에만 적용됩니다.' : '',
            anyReciprocal ? '체류자격 D-7·D-8·D-9는 상호주의 충족 여부를 알 수 없어 고용보험을 0원으로 계산했습니다. 충족되면 내국인과 같이 부과됩니다.' : '',
            pdfShowDurunuri
                ? '사업주 본인은 고용보험·산재보험 가입 대상이 아니며, 두루누리 지원 대상도 아닙니다.'
                : '사업주 본인은 고용보험·산재보험 가입 대상이 아닙니다.',
            ownerDisclaimer,
        ])}
    `;

    showPdfPreview(`4대보험_총부과금액_${dateSlug(today)}`);
}

// 처음부터 다시
function clearWorkerFields() {
    document.getElementById('workerSalary').value = '';
    document.getElementById('workerBirth').value = '';
    document.getElementById('workerInputError').style.display = 'none';
    document.getElementById('workerResultSection').style.display = 'none';
}

function clearEmployerFields() {
    document.getElementById('multiIndustryType').value = '';
    document.getElementById('multiWorkerRows').innerHTML = '';
    document.getElementById('employerInputError').style.display = 'none';
    document.getElementById('employerResultTabs').style.display = 'none';
    document.getElementById('employerButtonRow').style.display = 'none';
    document.getElementById('deductionResultContent').innerHTML = '';
    document.getElementById('burdenResultContent').innerHTML = '';
    document.getElementById('includeOwnerCheckbox').checked = false;
    document.getElementById('ownerInputRow').style.display = 'none';
    document.getElementById('ownerBirth').value = '';
    document.getElementById('ownerSalary').value = '';
    employerWorkersCalc = [];
    employerIndustryIdx = '';
    ownerCalc = null;
    mwDurunuriApplied = { deduction: {}, burden: {} };
    resetEmployerSubTabs();
}

function clearExpertFields() {
    document.getElementById('foreignerVisa').value = '';
    document.getElementById('foreignerCountry').value = '';
    document.getElementById('foreignerBirth').value = '';
    document.getElementById('foreignerSalary').value = '';
    document.getElementById('foreignerIndustryType').value = '';
    document.querySelector('input[name="foreignerJoin"][value="no"]').checked = true;
    document.getElementById('foreignerJoinRow').style.display = 'none';
    foreignerCalc = null;
    document.getElementById('foreignerResult').style.display = 'none';
    document.getElementById('foreignerResult').innerHTML = '';
    document.getElementById('foreignerExpand').classList.remove('open');
    document.getElementById('foreignerOptionBtn').classList.remove('active');
    document.getElementById('foreignerOptionBtn').setAttribute('aria-expanded', 'false');

    document.getElementById('totalBillIndustryType').value = '';
    document.querySelector('input[name="totalBillOwnerType"][value="individual"]').checked = true;
    document.getElementById('totalBillOwnerInputRow').style.display = 'flex';
    document.getElementById('totalBillOwnerBirth').value = '';
    document.getElementById('totalBillOwnerSalary').value = '';
    document.getElementById('totalBillWorkerRows').innerHTML = '';
    updateTotalBillCount();
    document.getElementById('totalBillInputError').style.display = 'none';
    document.getElementById('totalBillResult').style.display = 'none';
    document.getElementById('totalBillResult').innerHTML = '';
    document.getElementById('totalBillExpand').classList.remove('open');
    document.getElementById('totalBillOptionBtn').classList.remove('active');
    document.getElementById('totalBillOptionBtn').setAttribute('aria-expanded', 'false');

    totalBillWorkersCalc = [];
    totalBillOwnerCalc = null;
    totalBillIndustryIdx = '';
}

// 처음부터 다시 — 사업주/근로자 입력을 전부 지우고 첫 화면(선택 화면)으로 이동
function restart() {
    clearWorkerFields();
    clearEmployerFields();
    showStep('step2');
}

// 헤더의 새로고침 버튼 — 페이지를 다시 불러오지 않고, 지금 보고 있는 화면의 입력·결과만 지움
// (홈 화면에 추가해서 앱처럼 쓸 때 브라우저 새로고침이 없어서 대신 쓰는 버튼)
function headerRefresh() {
    const activeStep = document.querySelector('.step.active');
    if (!activeStep) return;

    if (activeStep.id === 'stepWorker') {
        clearWorkerFields();
    } else if (activeStep.id === 'stepEmployer') {
        clearEmployerFields();
    } else if (activeStep.id === 'stepExpert') {
        clearExpertFields();
    }
    // step2(선택 화면)는 입력칸이 따로 없어서 지울 게 없음
}

// 숫자 천 단위 콤마
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// PDF 저장 시 파일명으로 쓰기 좋은 날짜 문자열 (예: 20260904)
function dateSlug(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

// ---- PDF 미리보기 / 저장 ----
// 인쇄 창에서 "PDF로 저장"을 고르는 걸 모르는 사람이 많고, 아이폰 홈 화면 앱 모드는 인쇄 자체가 안 돼서
// 보고서를 화면에 먼저 보여주고(캡처해도 되게), PDF 파일은 브라우저에서 직접 만들어 내려받거나 공유함

let pdfState = { filename: '', file: null, job: 0 };

// PDF에 두루누리 금액을 넣을지 (사무실에서 대상 아닌 거래처에 보낼 때 끄려고). 끄면 계산기를 다시 열 때까지 유지
let pdfShowDurunuri = true;
let lastPdfRender = null;  // 체크박스를 바꾸면 같은 PDF를 다시 그리기 위해 마지막으로 연 PDF 함수를 기억

function togglePdfDurunuri(on) {
    pdfShowDurunuri = on;
    if (lastPdfRender) lastPdfRender();
}

function showPdfPreview(filename) {
    document.getElementById('pdfContent').innerHTML = document.getElementById('printArea').innerHTML;
    // 두루누리 대상자가 아예 없는 보고서에서는 체크박스를 숨김 (꺼 둔 상태면 다시 켤 수 있게 보여줌)
    const hasDurunuri = document.querySelector('#printArea .pr-dn, #printArea .pr-card.dn, #printArea .pr-dn-col');
    document.getElementById('pdfDnToggle').checked = pdfShowDurunuri;
    document.getElementById('pdfDnToggleRow').style.display = (!pdfShowDurunuri || hasDurunuri) ? '' : 'none';
    document.getElementById('pdfPreview').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.getElementById('pdfPreviewScroll').scrollTop = 0;
    document.querySelector('.pdf-preview-hint').textContent = '확대해서 보거나 화면을 캡처해도 돼요.';
    // 아이폰 홈 화면 앱 모드는 인쇄 창을 띄울 수 없어서 인쇄 버튼을 숨김
    document.getElementById('pdfPrintBtn').style.display = window.navigator.standalone ? 'none' : '';
    layoutPdfSheet();

    pdfState = { filename, file: null, job: pdfState.job + 1 };
    const job = pdfState.job;
    setPdfSaveButton(false, 'PDF 준비 중…');
    buildPdfFile(filename)
        .then(file => {
            if (job !== pdfState.job) return; // 그사이 닫거나 다른 미리보기를 열었으면 버림
            pdfState.file = file;
            setPdfSaveButton(true, 'PDF로 저장');
        })
        .catch(() => {
            if (job !== pdfState.job) return;
            setPdfSaveButton(false, 'PDF 만들기 실패');
            document.querySelector('.pdf-preview-hint').textContent = 'PDF 파일을 만들지 못했어요(인터넷 연결 확인). 화면을 캡처하거나 "인쇄"를 이용해 주세요.';
        });
}

function setPdfSaveButton(enabled, text) {
    const btn = document.getElementById('pdfSaveBtn');
    btn.disabled = !enabled;
    btn.textContent = text;
}

function closePdfPreview() {
    pdfState.job++;
    document.getElementById('pdfPreview').style.display = 'none';
    document.body.style.overflow = '';
    document.querySelector('.pdf-preview-hint').textContent = '확대해서 보거나 화면을 캡처해도 돼요.';
}

// A4 종이(210mm)를 화면 폭에 맞게 줄여서 보여줌 (줄인 만큼 바깥 상자 크기도 맞춰야 스크롤이 맞음)
function layoutPdfSheet() {
    const scroll = document.getElementById('pdfPreviewScroll');
    const wrap = document.getElementById('pdfSheetWrap');
    const sheet = document.getElementById('pdfSheet');
    sheet.style.transform = 'none';
    const sheetWidth = sheet.offsetWidth;
    const available = scroll.clientWidth - 24;
    const scale = Math.min(1, available / sheetWidth);
    sheet.style.transform = `scale(${scale})`;
    wrap.style.width = `${sheetWidth * scale}px`;
    wrap.style.height = `${sheet.offsetHeight * scale}px`;
}

window.addEventListener('resize', () => {
    if (document.getElementById('pdfPreview').style.display !== 'none') layoutPdfSheet();
});

// 기존 방식(브라우저 인쇄). 파일명 기본값으로 쓰이도록 문서 제목을 잠깐 바꿔서 인쇄
function printFromPreview() {
    const originalTitle = document.title;
    document.title = pdfState.filename;
    window.addEventListener('afterprint', () => {
        document.title = originalTitle;
    }, { once: true });
    setTimeout(() => window.print(), 100);
}

// 휴대폰은 공유 창(파일에 저장·카톡 등), PC는 바로 내려받기
// (공유 창은 버튼을 누른 그 순간에 열어야 해서, 파일을 미리 만들어 둔 뒤 여기서는 바로 씀)
function savePdfFile() {
    const file = pdfState.file;
    if (!file) return;
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: pdfState.filename }).catch(() => {});
        return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// PDF 라이브러리는 처음 PDF를 만들 때 한 번만 불러옴 (실패하면 다음에 다시 시도할 수 있게 기록을 지움)
const loadedScripts = {};
function loadScriptOnce(src) {
    if (!loadedScripts[src]) {
        loadedScripts[src] = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => { delete loadedScripts[src]; s.remove(); reject(); };
            document.head.appendChild(s);
        });
    }
    return loadedScripts[src];
}

// 외부 서버에 기대지 않도록 계산기 폴더(lib)에 같이 둠 (둘 다 MIT 라이선스 — 파일 맨 위 저작권 표시는 지우지 말 것)
const PDF_LIBS = [
    'lib/html2canvas.min.js',  // html2canvas 1.4.1
    'lib/jspdf.umd.min.js',    // jsPDF 2.5.1
];

// 보고서를 화면 밖에 실제 크기(본문 폭 178mm = A4 210mm − 여백 16mm×2)로 한 번 더 그려서 그림으로 바꾸고,
// A4 한 장 높이씩 잘라 PDF 쪽마다 붙임. 표 줄 중간이 잘리지 않게 줄이 시작하는 위치에서만 자름
async function buildPdfFile(filename) {
    await loadScriptOnce(PDF_LIBS[0]);
    await loadScriptOnce(PDF_LIBS[1]);

    const holder = document.createElement('div');
    holder.className = 'pdf-content';
    holder.style.cssText = 'position:fixed; left:-10000px; top:0; width:178mm; background:#fff;';
    holder.innerHTML = document.getElementById('printArea').innerHTML;
    document.body.appendChild(holder);

    try {
        const widthPx = holder.offsetWidth;
        const heightPx = holder.offsetHeight;
        const pageHeightPx = widthPx * 265 / 178; // 본문 높이 265mm (297 − 16×2)

        // 잘라도 되는 위치: 각 덩어리가 시작하는 높이 (두루누리 줄은 위 사람 줄과 붙어 있어야 하므로 제외)
        const top = holder.getBoundingClientRect().top;
        const cuts = [...holder.querySelectorAll('.pr-h2, .pr-cards, .pr-keys, .pr-keep, .pr-notes, .pr-notes p, tbody tr:not(.pr-dn)')]
            .filter(el => !(el.matches('tbody tr') && !el.previousElementSibling))
            .map(el => el.getBoundingClientRect().top - top)
            .filter(y => y > 0)
            .sort((a, b) => a - b);

        const pages = [];
        let start = 0;
        while (start < heightPx - 1) {
            const limit = start + pageHeightPx;
            if (limit >= heightPx) { pages.push([start, heightPx]); break; }
            const fits = cuts.filter(y => y > start + 1 && y <= limit);
            const end = fits.length ? fits[fits.length - 1] : limit;
            pages.push([start, end]);
            start = end;
        }

        // 아이폰은 캔버스 크기 한도(약 1,600만 화소)가 있어서 긴 보고서는 배율을 낮춤
        const scale = Math.min(2, Math.sqrt(15000000 / (widthPx * heightPx)));
        const canvas = await window.html2canvas(holder, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false });

        const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        pages.forEach(([from, to], i) => {
            const slice = document.createElement('canvas');
            slice.width = canvas.width;
            slice.height = Math.round((to - from) * scale);
            slice.getContext('2d').drawImage(canvas, 0, Math.round(from * scale), canvas.width, slice.height, 0, 0, canvas.width, slice.height);
            if (i > 0) pdf.addPage();
            pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 16, 16, 178, (to - from) * 178 / widthPx);
        });

        return new File([pdf.output('blob')], `${filename}.pdf`, { type: 'application/pdf' });
    } finally {
        holder.remove();
    }
}

// 퍼센트 숫자를 소수점 3자리까지 깔끔하게 반올림 (0.1314*100 같은 계산에서
// 생기는 13.139999999999999 같은 부동소수점 오차를 없애기 위함)
function roundRate(percentValue) {
    return Math.round(percentValue * 1000) / 1000;
}

// 요율을 "(4.75%)" 형식 문자열로 변환
function formatRate(percentValue) {
    return `(${roundRate(percentValue)}%)`;
}

// 전문가용 진입 (추후 개발)
function goToExpert() {
    populateForeignerDropdowns();
    clearExpertFields();
    showStep('stepExpert');
}

// 체류자격·국적 드롭다운을 페이지 로드 시 한 번만 채워두면 됨
function populateForeignerDropdowns() {
    const visaSelect = document.getElementById('foreignerVisa');
    if (visaSelect.options.length === 0) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '체류자격을 선택해주세요';
        visaSelect.appendChild(placeholder);

        VISA_TYPES.forEach((visa, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = `${visa.code} (${visa.name})`;
            visaSelect.appendChild(option);
        });
    }

    const countrySelect = document.getElementById('foreignerCountry');
    if (countrySelect.options.length === 0) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '국적을 선택해주세요';
        countrySelect.appendChild(placeholder);

        PENSION_COUNTRIES.forEach((country, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = country.name;
            countrySelect.appendChild(option);
        });
    }
}

// "외국인 근로자인가요?" 아코디언 펼치기/접기 — 위 근로자/사업주 선택과 같은 방식
function toggleExpertOption(type) {
    const expand = document.getElementById(`${type}Expand`);
    const btn = document.getElementById(`${type}OptionBtn`);
    if (!expand || !btn) return;
    const isOpen = expand.classList.toggle('open');
    btn.classList.toggle('active', isOpen);
    btn.setAttribute('aria-expanded', isOpen);

    // 하나를 펼치면 다른 항목은 접음 (사업주 결과의 두 탭과 같은 방식 — 입력·결과 내용은 그대로 남음)
    if (isOpen) {
        ['totalBill', 'foreigner'].filter(other => other !== type).forEach(other => {
            document.getElementById(`${other}Expand`).classList.remove('open');
            document.getElementById(`${other}OptionBtn`).classList.remove('active');
            document.getElementById(`${other}OptionBtn`).setAttribute('aria-expanded', 'false');
        });
    }

    if (type === 'totalBill' && isOpen) {
        initTotalBillWorkerRows();
    }
}

function buildForeignerEmploymentHTML(visa) {
    const label = `"${visa.code}(${visa.name})"`;
    let status;
    let excluded = false;
    let details = '';
    let reason;

    switch (visa.employment) {
        case 'full':
            status = '가입 대상';
            reason = `체류자격 ${label}은 고용보험 당연 적용 대상이에요. 사업주가 일반 피보험자격 취득신고를 하면 돼요.`;
            break;
        case 'reciprocal':
            status = '가입 대상 (상호주의 확인)';
            reason = `체류자격 ${label}은 상호주의를 충족하면 고용보험 당연 적용 대상이에요. 근로자의 본국 법령이 대한민국 국민에게 고용보험에 상응하는 보험료·급여를 적용하지 않는 나라라면 적용되지 않으니, 취득신고 전에 국적별 상호주의 여부를 꼭 확인해주세요.`;
            break;
        case 'partial':
            status = '일부 가입 대상';
            details = `
                <div class="fr-subrows">
                    <div class="fr-subrow"><span>고용안정·직업능력개발</span><span class="fr-chip in">의무 가입</span></div>
                    <div class="fr-subrow"><span>실업급여</span><span class="fr-chip part">근로자 신청 시 가입</span></div>
                </div>`;
            reason = `체류자격 ${label}은 고용안정·직업능력개발사업만 당연 적용이고, 실업급여는 근로자가 별도로 가입을 신청한 경우에만 적용돼요. 취득신고 시 실업급여 희망 여부를 따로 확인해주세요. 실업급여에 가입하지 않으면 근로자 공제분(실업급여 요율)은 없고, 사업주는 고용안정·직업능력개발 부분만 부담해요.`;
            break;
        case 'optional':
            status = '근로자 신청 시 가입';
            reason = `체류자격 ${label}은 고용보험 임의 적용 대상이에요. 근로자가 가입을 원하면 「외국인 고용보험 가입신청서」를 제출해야 하고, 신청하면 고용보험 전부(실업급여 포함)가 적용돼요.`;
            break;
        default:
            status = '제외 대상';
            excluded = true;
            reason = `체류자격 ${label}은 원칙적으로 고용보험 적용 제외 대상이에요.`;
    }

    const title = visa.employment === 'optional' ? '고용보험<span class="fr-verdict-sub">(실업급여)</span>' : '고용보험';
    const kind = excluded ? 'out' : visa.employment === 'full' ? 'in' : 'part';
    return { title, badge: frBadge(kind, status), details, reason };
}

// 판정 배지 — 빨강·초록 없이 채움 정도와 아이콘으로 구분 (가입=파랑 채움+체크, 일부=옅은 파랑+반원, 제외=회색 점선+빼기)
function frBadge(kind, text) {
    const icon = {
        in: '<path d="m5 12 4 4L19 6"/>',
        part: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/>',
        out: '<path d="M6 12h12"/>',
    }[kind];
    return `<span class="fr-badge ${kind}"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>${text}</span>`;
}

// 실업급여(또는 고용보험 전체)를 근로자가 신청해야 가입되는 체류자격만 "가입 신청 여부"를 물어봄
function toggleForeignerJoinRow() {
    const visaIdx = document.getElementById('foreignerVisa').value;
    const row = document.getElementById('foreignerJoinRow');
    const visa = visaIdx === '' ? null : VISA_TYPES[parseInt(visaIdx, 10)];

    if (!visa || (visa.employment !== 'partial' && visa.employment !== 'optional')) {
        row.style.display = 'none';
        return;
    }
    document.getElementById('foreignerJoinLabel').textContent = visa.employment === 'partial'
        ? '실업급여 가입을 신청했나요? (고용안정·직업능력개발은 의무 가입)'
        : '고용보험(실업급여) 가입을 신청했나요?';
    row.style.display = 'block';
}

// 고용보험을 어디까지 부과할지: all = 내국인과 같이 전부, stabilityOnly = 사업주 고용안정·직능분만, none = 0원
// D-7~9(상호주의)는 국가별 충족 여부를 알 수 없어서 미충족으로 보고 0원으로 계산함 (사용자 결정)
function foreignerEmploymentMode(visa, joined) {
    switch (visa.employment) {
        case 'full': return 'all';
        case 'partial': return joined ? 'all' : 'stabilityOnly';
        case 'optional': return joined ? 'all' : 'none';
        default: return 'none';
    }
}

// 내국인 계산을 그대로 한 뒤 국민연금·고용보험만 외국인 판정에 맞게 바꿈 (건강보험·장기요양·산재는 그대로)
function computeForeignerShares(salary, birthDate, industryIdx, pensionApplies, employmentMode) {
    const w = { ...computeWorkerShare(salary, birthDate) };
    const e = { ...computeEmployerShare(salary, birthDate, industryIdx) };

    if (!pensionApplies) {
        w.pension = 0;
        e.pensionEmployer = 0;
    }
    if (employmentMode === 'stabilityOnly') {
        w.employment = 0;
        e.employmentEmployer -= e.employmentUnemploymentEmployer;
        e.employmentUnemploymentEmployer = 0;
    } else if (employmentMode === 'none') {
        w.employment = 0;
        e.employmentEmployer = 0;
        e.employmentUnemploymentEmployer = 0;
    }

    w.total = w.pension + w.health + w.longterm + w.employment;
    w.netPay = salary - w.total;
    e.total = e.pensionEmployer + e.healthEmployer + e.longtermEmployer + e.employmentEmployer + (e.accidentEmployer || 0);

    // 두루누리: 외국인은 국민연금 지원 없음, 고용보험은 실업급여분이 부과될 때만 지원
    const noSupportAtAll = employmentMode !== 'all' || w.employmentExempt;
    w.noPensionDurunuri = e.noPensionDurunuri = true;
    w.durunuriNone = e.durunuriNone = noSupportAtAll;
    return { w, e };
}

function buildForeignerCalcHTML(salary, visa, pensionApplies, employmentMode, w, e) {
    const n = v => formatNumber(v);
    const sub = text => `<span class="fr-cell-sub">${text}</span>`;
    const employmentZeroReason = {
        stabilityOnly: '실업급여 미가입',
        none: { reciprocal: '상호주의 미확인', optional: '미가입' }[visa.employment] || '적용 제외',
    }[employmentMode];

    const pensionCell = (amount, exempt) => !pensionApplies ? `0${sub('적용 제외')}`
        : exempt ? `0${sub('60세 이상 면제')}` : n(amount);
    const workerEmploymentCell = employmentMode !== 'all' ? `0${sub(employmentZeroReason)}`
        : w.employmentExempt ? `0${sub('65세 이상 면제')}` : n(w.employment);
    const employerEmploymentCell = employmentMode === 'stabilityOnly' || (employmentMode === 'all' && e.employmentExempt)
        ? `${n(e.employmentEmployer)}${sub('고용안정·직능분만')}`
        : employmentMode === 'none' ? `0${sub(employmentZeroReason)}` : n(e.employmentEmployer);
    const accidentCell = e.accidentEmployer === null ? '<span class="xp-off">업종 미선택</span>' : n(e.accidentEmployer);

    const dn = computeForeignerDurunuri(salary, w, e);
    const dnRows = dn ? `
                    <tr class="fr-dn-row"><td>두루누리 적용 시 고용보험${sub('실업급여분만 지원')}</td><td>${n(dn.workerEmployment)}</td><td>${n(dn.employerEmployment)}</td></tr>
                    <tr class="fr-dn-row"><td>두루누리 적용 시 합계</td><td class="xp-strong">${n(dn.workerTotal)}</td><td class="xp-strong">${n(dn.employerTotal)}</td></tr>
                    <tr class="fr-dn-row"><td>두루누리 적용 시 실수령액</td><td>${n(salary - dn.workerTotal)}</td><td></td></tr>` : '';

    const notes = [
        dn ? durunuriCapNoticeText(false, dn.capped).replace(/^※\s*/, '') : '',
        '건강보험·장기요양보험·산재보험은 내국인과 같은 기준으로 계산했어요.',
        employmentMode === 'none' && visa.employment === 'reciprocal'
            ? '상호주의 충족 여부를 알 수 없어 고용보험을 0원으로 계산했어요. 본국 법령상 충족되면 내국인과 같이 부과돼요.' : '',
        '외국인은 국민연금 두루누리 지원 대상이 아니에요.',
        salary <= 2700000 && employmentMode !== 'all' ? '실업급여분 고용보험이 부과되지 않아 고용보험 두루누리 지원도 없어요.' : '',
    ].filter(Boolean);

    return `
        <div>
            <h3 class="xp-h3">보험료 계산 <span>(월급여 ${n(salary)}원 · 원)</span></h3>
            <table class="xp-table fr-table">
                <thead><tr><th scope="col">항목</th><th scope="col">근로자 공제</th><th scope="col">사업주 부담</th></tr></thead>
                <tbody>
                    <tr><td>국민연금</td><td>${pensionCell(w.pension, w.pensionExempt)}</td><td>${pensionCell(e.pensionEmployer, e.pensionExempt)}</td></tr>
                    <tr><td>건강보험</td><td>${n(w.health)}</td><td>${n(e.healthEmployer)}</td></tr>
                    <tr><td>장기요양보험</td><td>${n(w.longterm)}</td><td>${n(e.longtermEmployer)}</td></tr>
                    <tr><td>고용보험</td><td>${workerEmploymentCell}</td><td>${employerEmploymentCell}</td></tr>
                    <tr><td>산재보험</td><td class="xp-off">—</td><td>${accidentCell}</td></tr>
                    <tr class="xp-sum-row"><td>합계</td><td class="xp-sum-accent">${n(w.total)}</td><td class="xp-sum-accent">${n(e.total)}</td></tr>
                    <tr class="fr-net-row"><td>실수령액</td><td>${n(w.netPay)}</td><td></td></tr>${dnRows}
                </tbody>
            </table>
        </div>
        <ul class="fr-notes">${notes.map(t => `<li><span class="fr-mark" aria-hidden="true">※</span><span>${t}</span></li>`).join('')}</ul>`;
}

// 외국인 두루누리: 국민연금 지원 없음, 고용보험은 실업급여분이 부과될 때만 내국인과 같이 지원. 대상 아니면 null
function computeForeignerDurunuri(salary, w, e) {
    if (!hasDurunuri(salary, w)) return null;
    const workerEmployment = durunuriSupportedAmount(w.employment, DURUNURI_CAPS.employmentWorker);
    const workerCapped = durunuriCapApplied(w.employment, DURUNURI_CAPS.employmentWorker);
    const { employment: employerEmployment, capped: employerCapped } = durunuriEmployerEmployment(e);
    return {
        workerEmployment,
        employerEmployment,
        workerTotal: w.total - w.employment + workerEmployment,
        employerTotal: e.total - e.employmentEmployer + employerEmployment,
        capped: workerCapped || employerCapped,
    };
}

let foreignerCalc = null;  // 외국인 단독 계산 결과 (PDF 저장 시 재사용)

function printForeigner() {
    if (!foreignerCalc) return;
    lastPdfRender = printForeigner;
    const { visa, country, joined, pensionApplies, employmentMode, salary, industry, w, e } = foreignerCalc;
    const today = new Date();
    const dn = pdfShowDurunuri ? computeForeignerDurunuri(salary, w, e) : null;
    const cell = n => `<td>${formatNumber(n)}</td>`;
    const rows = buildPrintRowPair(prWhoHTML('근로자', `월 ${formatNumber(salary)} · ${visa.code} ${country.name}`), salary, w, e);

    const pensionStatus = pensionApplies ? '가입 대상'
        : visa.pensionExcluded ? '적용 제외 (체류자격)' : '적용 제외 (국적: 사회보장협정)';
    const employmentStatus = {
        full: '가입 대상',
        reciprocal: '상호주의 확인 필요 (미충족으로 계산)',
        partial: joined ? '고용안정·직능 의무 + 실업급여 가입' : '고용안정·직능만 가입 (실업급여 미가입)',
        optional: joined ? '가입 (근로자 신청)' : '미가입 (근로자 미신청)',
        excluded: '적용 제외',
    }[visa.employment];

    const itemRow = (name, rate, worker, employer) => `
        <tr><td>${name}<span class="pr-rate">${rate}</span></td>
            ${worker === null ? '<td class="pr-na">해당없음</td>' : cell(worker)}
            ${employer === null ? '<td class="pr-na">업종 미선택</td>' : cell(employer)}
            <td class="pr-strong">${formatNumber((worker || 0) + (employer || 0))}</td></tr>`;

    document.getElementById('printArea').innerHTML = `
        ${prHeadHTML('외국인 근로자 4대보험 내역', [
            `${prDateStr(today)} 기준`,
            `${visa.code}(${visa.name}) · ${country.name}`,
            `업종: ${industry ? `${industry.name} · 산재 ${industry.permille}/1000` : '선택 안 함'}`,
            '금액 단위: 원',
        ])}

        <section class="pr-keys">
            <div class="pr-key"><div class="pr-key-label">월급여</div><div class="pr-key-value">${formatNumber(salary)}<small>원</small></div></div>
            <div class="pr-key"><div class="pr-key-label">근로자 공제 합계</div><div class="pr-key-value pr-accent">${formatNumber(w.total)}<small>원</small></div></div>
            <div class="pr-key"><div class="pr-key-label">사업주 부담 합계</div><div class="pr-key-value">${formatNumber(e.total)}<small>원</small></div></div>
        </section>

        <h2 class="pr-h2">적용 판정</h2>
        <table class="pr-table">
            <tbody>
                <tr><td>국민연금</td><td>${pensionStatus}</td></tr>
                <tr><td>고용보험${visa.employment === 'optional' ? '<span class="pr-rate">실업급여</span>' : ''}</td><td>${employmentStatus}</td></tr>
            </tbody>
        </table>

        <h2 class="pr-h2">근로자 공제 내역 <span>· 근로자 월급에서 공제하는 금액</span></h2>
        <table class="pr-table">
            ${prDeductionHeadHTML()}
            <tbody>${rows.deductionRow}</tbody>
        </table>

        <h2 class="pr-h2">사업주 부담 내역 <span>· 사업주가 내는 금액</span></h2>
        <table class="pr-table">
            ${prBurdenHeadHTML(industry)}
            <tbody>${rows.burdenRow}</tbody>
        </table>

        <div class="pr-keep">
        <h2 class="pr-h2">항목별 합계 <span>· 근로자 + 사업주 (고지서 기준)</span></h2>
        <table class="pr-table">
            <thead><tr><th>항목</th><th>근로자 공제</th><th>사업주 부담</th><th>합계</th></tr></thead>
            <tbody>
                ${itemRow('국민연금', pensionApplies ? prPct(RATES.pension / 2 * 100) : '적용 제외', w.pension, e.pensionEmployer)}
                ${itemRow('건강보험', prPct(RATES.health / 2 * 100), w.health, e.healthEmployer)}
                ${itemRow('장기요양보험', `건강보험료의 ${prPct(RATES.longterm * 100)}`, w.longterm, e.longtermEmployer)}
                ${itemRow('고용보험', employmentMode === 'none' ? '0원으로 계산' : employmentMode === 'stabilityOnly' ? '사업주 고용안정분만' : `${prPct(RATES.employmentWorker * 100)} / ${prPct(RATES.employmentWorker * 100)}+${prPct(RATES.employmentStability * 100)}`, w.employment, e.employmentEmployer)}
                ${itemRow('산재보험', industry ? prPct(industry.permille / 10) : '', null, e.accidentEmployer)}
                ${prSumRowsHTML([w.total, e.total, w.total + e.total], dn ? [dn.workerTotal, dn.employerTotal, dn.workerTotal + dn.employerTotal] : null, 2)}
                <tr><td class="pr-strong">실수령액</td><td class="pr-strong">${formatNumber(w.netPay)}</td><td></td><td></td></tr>
            </tbody>
        </table>
        </div>

        ${prNotesHTML([
            '이 계산 결과는 참고용이며, 실제 적용 여부와 금액은 국민연금공단·근로복지공단 확인에 따라 달라질 수 있습니다.',
            '국민연금은 체류자격·국적(사회보장협정) 기준, 고용보험은 체류자격 기준으로 판정했습니다.',
            '건강보험·장기요양보험·산재보험은 내국인과 같은 기준으로 계산했습니다.',
            visa.employment === 'reciprocal' ? '체류자격 D-7·D-8·D-9는 상호주의 충족 여부를 알 수 없어 고용보험을 0원으로 계산했습니다. 충족되면 내국인과 같이 부과됩니다.' : '',
            pdfShowDurunuri ? '외국인은 국민연금 두루누리 지원 대상이 아닙니다.' : '',
            dn ? '"두루누리 적용 시"는 고용보험 실업급여분에만 지원금을 반영한 참고 금액이며, 실제 지원 여부는 근로복지공단 확인이 필요합니다.' : '',
            dn && dn.capped ? `월급여가 높아 고용보험 지원금은 상한액(${formatNumber(DURUNURI_CAPS.employmentWorker)}원)까지만 반영했습니다.` : '',
            '고용보험은 체류자격 외에도 65세 이후 신규 고용, 월 소정근로시간 60시간 미만 등 일반 적용제외 사유를 별도로 확인해야 합니다.',
            '표의 요율은 기본 요율이며, 각 보험료는 10원 미만을 절사했습니다.',
        ])}
    `;

    showPdfPreview(`4대보험_외국인_${visa.code}_${salary}원_${dateSlug(today)}`);
}

// 체류자격 → 국적 순서로 국민연금 당연적용 여부를 판단하고, 고용보험은 체류자격만으로 판단
// (국민연금: 체류자격 자체가 제외 대상이면 국적과 무관하게 제외, 아니면 국적이 "사업장·지역 적용제외국"인지만 확인)
// 생년월·월급여까지 입력하면 그 판정대로 보험료도 이어서 계산함
function checkForeignerInsurance() {
    const visaIdx = document.getElementById('foreignerVisa').value;
    const countryIdx = document.getElementById('foreignerCountry').value;
    const resultBox = document.getElementById('foreignerResult');

    if (visaIdx === '' || countryIdx === '') {
        resultBox.style.display = 'block';
        resultBox.innerHTML = '<p class="privacy-note input-error-note">⚠️ 체류자격과 국적을 모두 선택해주세요.</p>';
        return;
    }

    const birthRaw = document.getElementById('foreignerBirth').value.trim();
    const salaryRaw = document.getElementById('foreignerSalary').value.trim();
    const wantsCalc = birthRaw !== '' || salaryRaw !== '';
    const birthDate = parseBirthdate(birthRaw);
    const salaryVal = parseMoney(salaryRaw);

    if (wantsCalc && (!birthDate || !salaryVal || salaryVal <= 0)) {
        resultBox.style.display = 'block';
        resultBox.innerHTML = '<p class="privacy-note input-error-note">⚠️ 보험료를 계산하려면 생년월(6자리)과 월급여를 모두 올바르게 입력해주세요. 판정만 보려면 두 칸을 비워 두세요.</p>';
        return;
    }

    const visa = VISA_TYPES[parseInt(visaIdx, 10)];
    const country = PENSION_COUNTRIES[parseInt(countryIdx, 10)];

    let excluded;
    let reason;

    if (visa.pensionExcluded) {
        excluded = true;
        reason = `체류자격 "${visa.code}(${visa.name})"은 국적과 관계없이 국민연금 당연적용 제외 대상이에요.`;
    } else if (country.exempt) {
        excluded = true;
        reason = `체류자격 "${visa.code}(${visa.name})"은 당연적용 대상이지만, 국적(${country.name})이 국민연금 사회보장협정상 "사업장·지역 적용제외국"에 해당해서 제외돼요.`;
    } else {
        excluded = false;
        reason = `체류자격 "${visa.code}(${visa.name})"과 국적(${country.name}) 모두 국민연금 당연적용 대상이에요.`;
    }

    const joinedChoice = document.querySelector('input[name="foreignerJoin"]:checked');
    const employmentMode = foreignerEmploymentMode(visa, joinedChoice && joinedChoice.value === 'yes');
    const industryIdx = document.getElementById('foreignerIndustryType').value;
    const shares = wantsCalc
        ? computeForeignerShares(salaryVal, birthDate, industryIdx, !excluded, employmentMode)
        : null;
    foreignerCalc = wantsCalc ? {
        visa, country,
        joined: !!(joinedChoice && joinedChoice.value === 'yes'),
        pensionApplies: !excluded, employmentMode,
        salary: salaryVal,
        industry: industryIdx === '' ? null : INDUSTRY_RATES[parseInt(industryIdx, 10)],
        w: shares.w, e: shares.e,
    } : null;

    const emp = buildForeignerEmploymentHTML(visa);
    const NPS_URL = 'https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0035M0.do';

    resultBox.style.display = 'block';
    resultBox.innerHTML = `
        <div class="fr-result-head">
            <h3 class="xp-h3">판정 결과 <span>${visa.code} · ${country.name}</span></h3>
            <p class="fr-legend" aria-label="판정 표시 안내">
                <span><i class="fr-dot in"></i>가입 대상</span><span><i class="fr-dot part"></i>일부 가입</span><span><i class="fr-dot out"></i>제외 대상</span>
            </p>
        </div>

        <div class="fr-verdicts">
            <div class="fr-verdict">
                <div class="fr-verdict-head"><span class="fr-verdict-name">국민연금</span>${frBadge(excluded ? 'out' : 'in', excluded ? '제외 대상' : '가입 대상')}</div>
                <p class="fr-verdict-reason">${reason}</p>
            </div>
            <div class="fr-verdict">
                <div class="fr-verdict-head"><span class="fr-verdict-name">${emp.title}</span>${emp.badge}</div>
                ${emp.details}
            </div>
        </div>
        <p class="fr-emp-reason">${emp.reason}</p>

        ${wantsCalc ? buildForeignerCalcHTML(salaryVal, visa, !excluded, employmentMode, shares.w, shares.e)
            : `<p class="fr-info">${XP_INFO_ICON}<span>생년월과 월급여를 입력하면 이 판정대로 보험료도 계산해 드려요.</span></p>`}

        <details class="fr-details" open>
            <summary>확인할 점과 근거 자료<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></summary>
            <div class="fr-details-body">
                <p>※ 고용보험은 체류자격 외에도 <b>65세 이후 신규 고용</b>, <b>월 소정근로시간 60시간 미만</b> 등 일반 적용제외 사유를 별도로 확인해야 해요.</p>
                <div class="fr-sources">
                    <p>※ 아래 자료를 바탕으로 한 참고용이에요.</p>
                    <dl>
                        <dt>국민연금</dt>
                        <dd>국민연금공단에서 제공하는 <a href="${NPS_URL}" target="_blank" rel="noopener noreferrer">[2026.3.19]기준 국가별 연금제도 자료</a>와 <a href="${NPS_URL}" target="_blank" rel="noopener noreferrer">[2024.4.1]기준 체류자격별 적용 자료</a></dd>
                        <dt>고용보험</dt>
                        <dd>「고용보험법」 제10조의2 및 같은 법 시행령에 따른 [2026.10]기준 체류자격별 적용 내용</dd>
                    </dl>
                    <p>실제 적용 여부는 국민연금공단과 관할 근로복지공단 지사에 별도로 확인해주세요.</p>
                </div>
            </div>
        </details>

        ${wantsCalc ? `<div class="fr-actions"><button class="btn-primary xp-pdf-btn" onclick="printForeigner()">${XP_PDF_ICON}PDF로 저장</button></div>` : ''}
    `;
}

// 산재보험 업종 드롭다운은 페이지 로드 시 한 번만 채워두면 됨
// (스크립트 태그가 body 맨 끝에 있어 이 시점엔 이미 DOM이 준비되어 있음)
populateIndustryOptions('multiIndustryType');
populateIndustryOptions('totalBillIndustryType');
populateIndustryOptions('foreignerIndustryType');

// 배경 공 — 공마다 화면 안의 무작위 지점을 골라 10~16초에 걸쳐 천천히 옮겨 가고, 도착하면 다음 지점을 고름
// (움직임 줄이기를 켠 사용자는 처음 자리에 멈춰 둠)
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.blob').forEach(blob => {
        const moveBlob = () => {
            const seconds = 10 + Math.random() * 6;
            const x = 5 + Math.random() * 90;      // 화면 가로 5~95% 지점
            const y = 5 + Math.random() * 90;      // 화면 세로 5~95% 지점
            const scale = 0.9 + Math.random() * 0.25;
            blob.style.transitionDuration = `${seconds}s`;
            blob.style.transform = `translate(calc(${x}vw - 50%), calc(${y}vh - 50%)) scale(${scale})`;
            setTimeout(moveBlob, seconds * 1000);
        };
        setTimeout(moveBlob, 300);
    });
}

// 첫 화면의 요율 한 줄 요약 — RATES 값으로 채워서, 요율을 고치면 여기도 같이 바뀌게 함
document.getElementById('rateSummary').textContent =
    `2026년 요율 · 국민연금 ${roundRate(RATES.pension / 2 * 100)}% · 건강 ${roundRate(RATES.health / 2 * 100)}% · ` +
    `장기요양 건보료의 ${roundRate(RATES.longterm * 100)}% · 고용 ${roundRate(RATES.employmentWorker * 100)}%`;

// 페이지 로드 시 서비스 워커 등록 (PWA)
window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // 로컬 환경에서는 등록 실패해도 무시
        });
    }
});
