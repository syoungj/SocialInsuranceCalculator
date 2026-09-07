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
// 외국인 근로자 — 국민연금 적용 판단용 자료
// ========================================

// 체류자격별 국민연금 당연적용 여부 (2024.4.1. 기준) — 국적과 무관하게 여기서 먼저 걸러짐
const VISA_TYPES = [
    { code: 'A-1', name: '외교', pensionExcluded: true },
    { code: 'A-2', name: '공무', pensionExcluded: true },
    { code: 'A-3', name: '협정', pensionExcluded: true },
    { code: 'B-1', name: '사증면제', pensionExcluded: true },
    { code: 'B-2', name: '관광통과', pensionExcluded: true },
    { code: 'C-1', name: '일시취재', pensionExcluded: true },
    { code: 'C-3', name: '단기방문', pensionExcluded: true },
    { code: 'C-4', name: '단기취업', pensionExcluded: true },
    { code: 'D-1', name: '문화예술', pensionExcluded: true },
    { code: 'D-2', name: '유학', pensionExcluded: true },
    { code: 'D-3', name: '기술연수', pensionExcluded: true },
    { code: 'D-4', name: '일반연수', pensionExcluded: true },
    { code: 'D-5', name: '취재', pensionExcluded: false },
    { code: 'D-6', name: '종교', pensionExcluded: true },
    { code: 'D-7', name: '주재', pensionExcluded: false },
    { code: 'D-8', name: '기업투자', pensionExcluded: false },
    { code: 'D-9', name: '무역경영', pensionExcluded: false },
    { code: 'D-10', name: '구직', pensionExcluded: false },
    { code: 'E-1', name: '교수', pensionExcluded: false },
    { code: 'E-2', name: '회화', pensionExcluded: false },
    { code: 'E-3', name: '연구', pensionExcluded: false },
    { code: 'E-4', name: '기술지도', pensionExcluded: false },
    { code: 'E-5', name: '전문직업', pensionExcluded: false },
    { code: 'E-6', name: '예술흥행', pensionExcluded: false },
    { code: 'E-7', name: '특정활동', pensionExcluded: false },
    { code: 'E-8', name: '계절근로', pensionExcluded: false },
    { code: 'E-9', name: '비전문취업', pensionExcluded: false },
    { code: 'E-10', name: '선원취업', pensionExcluded: false },
    { code: 'F-1', name: '방문동거', pensionExcluded: true },
    { code: 'F-2', name: '거주', pensionExcluded: false },
    { code: 'F-3', name: '동반', pensionExcluded: true },
    { code: 'F-4', name: '재외동포', pensionExcluded: false },
    { code: 'F-5', name: '영주', pensionExcluded: false },
    { code: 'F-6', name: '결혼이민', pensionExcluded: false },
    { code: 'G-1', name: '기타', pensionExcluded: true },
    { code: 'H-1', name: '관광취업', pensionExcluded: false },
    { code: 'H-2', name: '방문취업', pensionExcluded: false },
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
let mwDurunuriApplied = { deduction: {}, burden: {} };  // 근로자 여러명 결과 — 근로자별(또는 사업주 본인) 두루누리 토글 상태
let ownerCalc = null;              // 사업주 경로 — 체크박스로 선택했을 때만 채워지는 "사업주 본인" 계산 결과
let ownerDurunuriApplied = false;  // 사업주 본인 결과 — 두루누리 토글 상태 (국민연금에만 적용)

function showStep(id) {
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.getElementById(id).classList.add('active');
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
    const pension = pensionExempt ? 0 : Math.floor((pensionBase * RATES.pension / 2) / 10) * 10;

    // 건강보험 · 장기요양보험: 둘 다 일의 단위(10원 미만) 절사
    const health = Math.floor((workerSalary * RATES.health / 2) / 10) * 10;
    const longterm = Math.floor((health * RATES.longterm) / 10) * 10;
    const employment = employmentExempt ? 0 : Math.floor((workerSalary * RATES.employmentWorker) / 10) * 10;
    const total = pension + health + longterm + employment;
    const netPay = workerSalary - total;

    return {
        pension, health, longterm, employment, total, netPay,
        pensionExempt, employmentExempt, pensionExemptNextMonth, employmentExemptNextMonth
    };
}

// 근로자(단일) 계산 — 급여/생년월 입력칸을 직접 읽어서 계산
function calculateWorkerResult() {
    const salaryVal = parseInt(document.getElementById('workerSalary').value, 10);
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
    const pensionEmployer = pensionExempt ? 0 : Math.floor((pensionBase * RATES.pension / 2) / 10) * 10;

    const healthWorkerHalf = Math.floor((workerSalary * RATES.health / 2) / 10) * 10;
    const healthEmployer = healthWorkerHalf; // 건강보험은 나이 제한 없이 계속 부과됨 (근로자·사업주 절반씩 동일)

    const longtermEmployer = Math.floor((healthWorkerHalf * RATES.longterm) / 10) * 10;

    // 고용보험 사업주 몫: 실업급여분(0.9%, 65세 이상 제외)은 근로자와 동일하게 나이 영향을 받고,
    // 고용안정·직업능력개발사업분(0.25%)은 사업주 전용이라 나이와 무관하게 계속 부과됨
    const employmentEmployerRate = employmentExempt
        ? RATES.employmentStability
        : RATES.employmentWorker + RATES.employmentStability;
    const employmentEmployer = Math.floor((workerSalary * employmentEmployerRate) / 10) * 10;

    // 산재보험 — 업종을 선택했을 때만 계산 (선택 전에는 총액에서 제외)
    let accidentEmployer = null;
    let accidentPermille = null;
    if (industryIdx !== '' && industryIdx !== null && industryIdx !== undefined) {
        const industry = INDUSTRY_RATES[parseInt(industryIdx, 10)];
        accidentEmployer = Math.floor((workerSalary * industry.permille / 1000) / 10) * 10;
        accidentPermille = industry.permille;
    }

    const total = pensionEmployer + healthEmployer + longtermEmployer + employmentEmployer + (accidentEmployer || 0);

    return {
        pensionEmployer, healthEmployer, longtermEmployer, employmentEmployer, accidentEmployer, total,
        pensionExempt, employmentExempt, pensionExemptNextMonth, employmentExemptNextMonth,
        employmentEmployerRate, accidentPermille
    };
}

// 사업주 본인 보험료 계산 — 근로자와 달리 사업주(대표자)는 고용보험·산재보험 가입 대상이 아니므로
// 국민연금·건강보험(+장기요양)만 계산함 (고용·산재는 아예 계산하지 않음)
function computeOwnerShare(ownerSalary, ownerBirthDate) {
    const { pensionExempt, pensionExemptNextMonth } = calculateExemptions(ownerBirthDate);

    const pensionBase = Math.floor(ownerSalary / 1000) * 1000;
    const pensionEmployer = pensionExempt ? 0 : Math.floor((pensionBase * RATES.pension / 2) / 10) * 10;

    const healthEmployer = Math.floor((ownerSalary * RATES.health / 2) / 10) * 10;
    const longtermEmployer = Math.floor((healthEmployer * RATES.longterm) / 10) * 10;

    const total = pensionEmployer + healthEmployer + longtermEmployer;

    return { pensionEmployer, healthEmployer, longtermEmployer, total, pensionExempt, pensionExemptNextMonth };
}

// 두루누리 지원 적용 시 본인 부담액 (80% 지원, 상한액 있으면 상한액만큼만 지원)
function durunuriSupportedAmount(original, cap) {
    const support80 = Math.floor((original * 0.8) / 10) * 10;
    if (support80 > cap) {
        return original - cap;
    }
    return Math.floor((original * 0.2) / 10) * 10;
}

// 두루누리 지원 토글 (근로자 단일 계산)
function toggleDurunuri() {
    durunuriApplied = !durunuriApplied;
    const btn = document.getElementById('durunuriToggleBtn');

    let pension = calc.pension;
    let employment = calc.employment;

    if (durunuriApplied) {
        if (!calc.pensionExempt) {
            pension = durunuriSupportedAmount(calc.pension, DURUNURI_CAPS.pension);
        }
        if (!calc.employmentExempt) {
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
            <input type="number" class="mw-salary" inputmode="numeric" placeholder="월급여" autocomplete="new-password">
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
    if (applied) {
        if (!s.pensionExempt) pension = durunuriSupportedAmount(s.pension, DURUNURI_CAPS.pension);
        if (!s.employmentExempt) employment = durunuriSupportedAmount(s.employment, DURUNURI_CAPS.employmentWorker);
    }
    const total = pension + s.health + s.longterm + employment;
    const netPay = w.salary - total;

    return { pension, health: s.health, longterm: s.longterm, employment, total, netPay, applied };
}

// 근로자 여러명 결과 — idx번째 근로자의 "현재 화면에 보이는" 사업주 부담 내역 계산 (두루누리 토글 상태 반영)
function getEffectiveEmployerShare(idx) {
    const w = getMwRecord(idx);
    const s = w.employerShare;
    const applied = !!mwDurunuriApplied.burden[idx];

    let pension = s.pensionEmployer;
    let employment = s.employmentEmployer;
    if (applied) {
        if (!s.pensionExempt) pension = durunuriSupportedAmount(s.pensionEmployer, DURUNURI_CAPS.pension);
        employment = durunuriSupportedAmount(s.employmentEmployer, DURUNURI_CAPS.employmentWorker);
    }
    const accident = s.accidentEmployer || 0;
    const total = pension + s.healthEmployer + s.longtermEmployer + employment + accident;

    return { pension, health: s.healthEmployer, longterm: s.longtermEmployer, employment, accident, total, applied };
}

// PDF 저장용 — 화면 토글 상태와 무관하게 "두루누리를 적용했다면"의 금액을 그대로 계산 (대상자는 PDF에 항상 같이 표시)
function computeDurunuriDeduction(s, salary) {
    const pension = s.pensionExempt ? s.pension : durunuriSupportedAmount(s.pension, DURUNURI_CAPS.pension);
    const employment = s.employmentExempt ? s.employment : durunuriSupportedAmount(s.employment, DURUNURI_CAPS.employmentWorker);
    const total = pension + s.health + s.longterm + employment;
    const netPay = salary - total;
    return { pension, health: s.health, longterm: s.longterm, employment, total, netPay };
}

function computeDurunuriBurden(s) {
    const pension = s.pensionExempt ? s.pensionEmployer : durunuriSupportedAmount(s.pensionEmployer, DURUNURI_CAPS.pension);
    const employment = durunuriSupportedAmount(s.employmentEmployer, DURUNURI_CAPS.employmentWorker);
    const accident = s.accidentEmployer || 0;
    const total = pension + s.healthEmployer + s.longtermEmployer + employment + accident;
    return { pension, health: s.healthEmployer, longterm: s.longtermEmployer, employment, accident, total };
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
    } else {
        const eff = getEffectiveEmployerShare(idx);

        document.getElementById(`burdenPension${idx}`).textContent = formatNumber(eff.pension) + '원';
        document.getElementById(`burdenEmployment${idx}`).textContent = formatNumber(eff.employment) + '원';
        document.getElementById(`burdenSummaryTotal${idx}`).textContent = formatNumber(eff.total) + '원';

        [`burdenPension${idx}`, `burdenEmployment${idx}`, `burdenSummaryTotal${idx}`].forEach(id => {
            document.getElementById(id).classList.toggle('value-changed', applied);
        });
    }
}

// 근로자별 소소 노트 (나이 예외 / 두루누리 대상 여부) 문구 생성
function shareNotes(share, workerSalary) {
    const notes = [];
    if (share.pensionExempt) notes.push('국민연금 면제');
    if (share.employmentExempt) notes.push('고용보험 면제');
    if (share.pensionExemptNextMonth) notes.push('다음달 국민연금 면제 예정');
    if (share.employmentExemptNextMonth) notes.push('다음달 고용보험 면제 예정');
    if (workerSalary <= 2700000) notes.push('두루누리 지원 가능');
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
                    ${eligible ? `<button class="mw-durunuri-btn" id="deductionDurunuriBtn${key}" onclick="toggleMwDurunuri('deduction', '${key}')">두루누리 지원받으면 얼마?</button>` : ''}
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
                    ${eligible ? `<button class="mw-durunuri-btn" id="burdenDurunuriBtn${key}" onclick="toggleMwDurunuri('burden', '${key}')">두루누리 지원받으면 얼마?</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

// 사업주 본인 카드 HTML 생성 — 근로자와 달리 고용보험·산재보험 항목이 아예 없음 (가입 대상이 아니라서)
function buildOwnerBurdenItemHTML(salary, s) {
    const notes = shareNotes(s, salary);
    const eligible = salary <= 2700000;
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
                    <div class="result-row"><span>국민연금<span class="rate-tag">${s.pensionExempt ? '(면제)' : formatRate(RATES.pension / 2 * 100)}</span></span><span id="burdenPensionowner">${formatNumber(s.pensionEmployer)}원</span></div>
                    <div class="result-row"><span>건강보험<span class="rate-tag">${formatRate(RATES.health / 2 * 100)}</span></span><span>${formatNumber(s.healthEmployer)}원</span></div>
                    <div class="result-row"><span>장기요양보험<span class="rate-tag">(건강보험료 × ${roundRate(RATES.longterm * 100)}%)</span></span><span>${formatNumber(s.longtermEmployer)}원</span></div>
                    ${eligible ? `<button class="mw-durunuri-btn" id="burdenDurunuriBtnowner" onclick="toggleOwnerDurunuri()">두루누리 지원받으면 얼마?</button>` : ''}
                    <p class="mw-owner-note">ℹ️ 사업주는 고용산재보험 대상이 아닙니다.</p>
                </div>
            </div>
        </div>
    `;
}

// 사업주 본인 결과의 두루누리 토글 (근로자용과 달리 국민연금에만 적용 — 고용보험 항목이 없어서)
function toggleOwnerDurunuri() {
    ownerDurunuriApplied = !ownerDurunuriApplied;
    const btn = document.getElementById('burdenDurunuriBtnowner');
    btn.textContent = ownerDurunuriApplied ? '원래 금액 보기' : '두루누리 지원받으면 얼마?';
    btn.classList.toggle('applied', ownerDurunuriApplied);

    const s = ownerCalc.ownerShare;
    const pension = (ownerDurunuriApplied && !s.pensionExempt)
        ? durunuriSupportedAmount(s.pensionEmployer, DURUNURI_CAPS.pension)
        : s.pensionEmployer;
    const total = pension + s.healthEmployer + s.longtermEmployer;

    document.getElementById('burdenPensionowner').textContent = formatNumber(pension) + '원';
    document.getElementById('burdenSummaryTotalowner').textContent = formatNumber(total) + '원';

    ['burdenPensionowner', 'burdenSummaryTotalowner'].forEach(id => {
        document.getElementById(id).classList.toggle('value-changed', ownerDurunuriApplied);
    });
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

        const workerSalary = parseInt(salaryRaw, 10);
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
        const ownerSalaryVal = parseInt(ownerSalaryRaw, 10);

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
    ownerDurunuriApplied = false;
    mwDurunuriApplied = { deduction: {}, burden: {} };

    document.getElementById('deductionResultContent').innerHTML = renderDeductionContent(employerWorkersCalc);
    document.getElementById('burdenResultContent').innerHTML = renderBurdenContent(employerWorkersCalc, ownerCalc);

    tabsBox.style.display = 'block';
    buttonRow.style.display = 'flex';
}

// 근로자(단일) 계산 결과를 PDF로 저장 (브라우저 인쇄 기능 이용 — 서버 저장 없이 그대로 로컬에 저장됨)
function printResult(type) {
    if (type !== 'worker') return;

    const printArea = document.getElementById('printArea');
    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`;

    function noticeHTML(id) {
        const el = document.getElementById(id);
        if (!el || el.style.display === 'none' || !el.textContent) return '';
        return `<p class="print-notice">${el.textContent}</p>`;
    }

    function bannerHTML(bannerId) {
        const banner = document.getElementById(bannerId);
        if (!banner || banner.style.display === 'none') return '';
        const desc = banner.querySelector('.banner-desc');
        return `<p class="print-notice">✅ ${desc ? desc.textContent : ''}</p>`;
    }

    // 두루누리 지원 가능 대상이면(급여 270만원 이하) 화면 토글 상태와 무관하게 적용 시 금액도 함께 보여줌
    const eligible = salary <= 2700000;
    const dd = eligible ? computeDurunuriDeduction(calc, salary) : null;
    const durunuriRow = (value) => `<tr class="print-durunuri-row"><td>└ 두루누리 적용 시</td><td>${value}</td></tr>`;

    printArea.innerHTML = `
        <div class="print-header">
            <h2>내 월급에서 얼마 떼나요?</h2>
            <p>국민노무법인 4대보험 계산 결과 · ${dateStr} 기준</p>
        </div>
        <div class="print-salary">월급여액 ${document.getElementById('displaySalary').textContent}</div>
        <table class="print-table">
            <tr class="print-total"><th>실수령액</th><td>${document.getElementById('resultNetPay').textContent}</td></tr>
            ${dd ? durunuriRow(formatNumber(dd.netPay) + '원') : ''}
            <tr><th>국민연금 ${document.getElementById('resultPensionRate').textContent}</th><td>${document.getElementById('resultPension').textContent}</td></tr>
            ${dd ? durunuriRow(formatNumber(dd.pension) + '원') : ''}
            <tr><th>건강보험 ${document.getElementById('resultHealthRate').textContent}</th><td>${document.getElementById('resultHealth').textContent}</td></tr>
            <tr><th>장기요양보험 ${document.getElementById('resultLongtermRate').textContent}</th><td>${document.getElementById('resultLongterm').textContent}</td></tr>
            <tr><th>고용보험 ${document.getElementById('resultEmploymentRate').textContent}</th><td>${document.getElementById('resultEmployment').textContent}</td></tr>
            ${dd ? durunuriRow(formatNumber(dd.employment) + '원') : ''}
            <tr class="print-subtotal"><th>공제 합계</th><td>${document.getElementById('resultTotal').textContent}</td></tr>
            ${dd ? durunuriRow(formatNumber(dd.total) + '원') : ''}
        </table>
        ${noticeHTML('ageNotice')}
        ${bannerHTML('durunuriBanner')}
        <p class="print-disclaimer">※ 이 계산 결과는 참고용이며, 실제 신고·공제 금액은 담당 기관 확인에 따라 달라질 수 있습니다.${dd ? ' "두루누리 적용 시" 줄은 급여 270만원 이하로 두루누리 지원 가능 대상일 때 참고로 함께 보여드리는 금액이며, 실제 지원 여부는 근로복지공단 확인이 필요합니다.' : ''}</p>
    `;

    printWithFilenameTitle(`4대보험_내월급_${salary}원_${dateSlug(today)}`);
}

// 사업주 경로(근로자 여러명) 계산 결과를 PDF로 저장 — 근로자 공제분/사업주 부담분 표를 함께 출력
// PDF용 표 한 줄(근로자 또는 사업주 본인) 생성 — 두루누리 대상이면 바로 아래에 적용 시 금액 줄도 같이 만듦
function buildPrintRowPair(label, salary, d, b) {
    let deductionRow = `
        <tr>
            <td>${label}</td>
            <td>${formatNumber(d.pension)}원</td>
            <td>${formatNumber(d.health)}원</td>
            <td>${formatNumber(d.longterm)}원</td>
            <td>${formatNumber(d.employment)}원</td>
            <td>${formatNumber(d.total)}원</td>
            <td>${formatNumber(d.netPay)}원</td>
        </tr>
    `;
    let burdenRow = `
        <tr>
            <td>${label}</td>
            <td>${formatNumber(b.pensionEmployer)}원</td>
            <td>${formatNumber(b.healthEmployer)}원</td>
            <td>${formatNumber(b.longtermEmployer)}원</td>
            <td>${formatNumber(b.employmentEmployer)}원</td>
            <td>${b.accidentEmployer === null ? '업종 미선택' : formatNumber(b.accidentEmployer) + '원'}</td>
            <td>${formatNumber(b.total)}원</td>
        </tr>
    `;

    if (salary <= 2700000) {
        const dd = computeDurunuriDeduction(d, salary);
        const bb = computeDurunuriBurden(b);

        deductionRow += `
            <tr class="print-durunuri-row">
                <td>└ 두루누리 적용 시</td>
                <td>${formatNumber(dd.pension)}원</td>
                <td>${formatNumber(dd.health)}원</td>
                <td>${formatNumber(dd.longterm)}원</td>
                <td>${formatNumber(dd.employment)}원</td>
                <td>${formatNumber(dd.total)}원</td>
                <td>${formatNumber(dd.netPay)}원</td>
            </tr>
        `;
        burdenRow += `
            <tr class="print-durunuri-row">
                <td>└ 두루누리 적용 시</td>
                <td>${formatNumber(bb.pension)}원</td>
                <td>${formatNumber(bb.health)}원</td>
                <td>${formatNumber(bb.longterm)}원</td>
                <td>${formatNumber(bb.employment)}원</td>
                <td>${b.accidentEmployer === null ? '업종 미선택' : formatNumber(bb.accident) + '원'}</td>
                <td>${formatNumber(bb.total)}원</td>
            </tr>
        `;
    }

    return { deductionRow, burdenRow };
}

function printEmployerAll() {
    if (employerWorkersCalc.length === 0 && !ownerCalc) return;

    const printArea = document.getElementById('printArea');
    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`;

    const industry = employerIndustryIdx !== '' ? INDUSTRY_RATES[parseInt(employerIndustryIdx, 10)] : null;
    const industryLabel = industry ? `${industry.name} (${industry.permille}/1000)` : '선택 안 함';

    let deductionRows = '';
    let burdenRows = '';
    let sumDeduction = 0, sumDeductionPension = 0, sumDeductionHealth = 0, sumDeductionLongterm = 0, sumDeductionEmployment = 0, sumNetPay = 0;
    let sumBurden = 0, sumBurdenPension = 0, sumBurdenHealth = 0, sumBurdenLongterm = 0, sumBurdenEmployment = 0, sumBurdenAccident = 0;

    employerWorkersCalc.forEach((w, idx) => {
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

        const workerLabel = `근로자 ${idx + 1}<span class="print-salary-sub">${formatNumber(w.salary)}원</span>`;
        const { deductionRow, burdenRow } = buildPrintRowPair(workerLabel, w.salary, d, b);
        deductionRows += deductionRow;
        burdenRows += burdenRow;
    });

    // 사업주 본인은 "근로자 공제" 표에는 안 넣음(헷갈릴 수 있어서) — "사업주 부담" 표에는 넣고 합계에도 포함시킴
    // (고용보험·산재보험은 사업주 대상이 아니어서 해당 칸은 "해당없음"으로 표시)
    if (ownerCalc) {
        const os = ownerCalc.ownerShare;
        const ownerLabel = `사업주 본인<span class="print-salary-sub">${formatNumber(ownerCalc.salary)}원</span>`;

        burdenRows += `
            <tr>
                <td>${ownerLabel}</td>
                <td>${formatNumber(os.pensionEmployer)}원</td>
                <td>${formatNumber(os.healthEmployer)}원</td>
                <td>${formatNumber(os.longtermEmployer)}원</td>
                <td>해당없음</td>
                <td>해당없음</td>
                <td>${formatNumber(os.total)}원</td>
            </tr>
        `;

        if (ownerCalc.salary <= 2700000 && !os.pensionExempt) {
            const supportedPension = durunuriSupportedAmount(os.pensionEmployer, DURUNURI_CAPS.pension);
            const supportedTotal = supportedPension + os.healthEmployer + os.longtermEmployer;
            burdenRows += `
                <tr class="print-durunuri-row">
                    <td>└ 두루누리 적용 시</td>
                    <td>${formatNumber(supportedPension)}원</td>
                    <td>${formatNumber(os.healthEmployer)}원</td>
                    <td>${formatNumber(os.longtermEmployer)}원</td>
                    <td>해당없음</td>
                    <td>해당없음</td>
                    <td>${formatNumber(supportedTotal)}원</td>
                </tr>
            `;
        }

        sumBurden += os.total;
        sumBurdenPension += os.pensionEmployer;
        sumBurdenHealth += os.healthEmployer;
        sumBurdenLongterm += os.longtermEmployer;
    }

    const anyExempt = employerWorkersCalc.some(w =>
        w.workerShare.pensionExempt || w.workerShare.employmentExempt ||
        w.workerShare.pensionExemptNextMonth || w.workerShare.employmentExemptNextMonth
    ) || (ownerCalc && (ownerCalc.ownerShare.pensionExempt || ownerCalc.ownerShare.pensionExemptNextMonth));
    const accidentRateLabel = industry ? formatRate(industry.permille / 10) : '';

    printArea.innerHTML = `
        <div class="print-header">
            <h2>직원 채용하면 제가 얼마 내나요?</h2>
            <p>국민노무법인 4대보험 계산 결과 · ${dateStr} 기준 · 업종: ${industryLabel}</p>
        </div>

        <h3 class="print-subheader">근로자 월급에서 얼마 공제하나요?</h3>
        <table class="print-table">
            <tr>
                <th>근로자</th>
                <th>국민연금${formatRate(RATES.pension / 2 * 100)}</th>
                <th>건강보험${formatRate(RATES.health / 2 * 100)}</th>
                <th>장기요양(건강보험료×${roundRate(RATES.longterm * 100)}%)</th>
                <th>고용보험${formatRate(RATES.employmentWorker * 100)}</th>
                <th>공제 합계</th><th>실수령액</th>
            </tr>
            ${deductionRows}
            <tr class="print-total">
                <th>합계</th>
                <td>${formatNumber(sumDeductionPension)}원</td>
                <td>${formatNumber(sumDeductionHealth)}원</td>
                <td>${formatNumber(sumDeductionLongterm)}원</td>
                <td>${formatNumber(sumDeductionEmployment)}원</td>
                <td>${formatNumber(sumDeduction)}원</td>
                <td>${formatNumber(sumNetPay)}원</td>
            </tr>
        </table>

        <h3 class="print-subheader">사업주는 얼마 부담해야 하나요?</h3>
        <table class="print-table">
            <tr>
                <th>근로자</th>
                <th>국민연금${formatRate(RATES.pension / 2 * 100)}</th>
                <th>건강보험${formatRate(RATES.health / 2 * 100)}</th>
                <th>장기요양(건강보험료×${roundRate(RATES.longterm * 100)}%)</th>
                <th>고용보험(${roundRate(RATES.employmentWorker * 100)}%+${roundRate(RATES.employmentStability * 100)}%)</th>
                <th>산재보험${accidentRateLabel}</th>
                <th>사업주 부담 합계</th>
            </tr>
            ${burdenRows}
            <tr class="print-total">
                <th>합계</th>
                <td>${formatNumber(sumBurdenPension)}원</td>
                <td>${formatNumber(sumBurdenHealth)}원</td>
                <td>${formatNumber(sumBurdenLongterm)}원</td>
                <td>${formatNumber(sumBurdenEmployment)}원</td>
                <td>${formatNumber(sumBurdenAccident)}원</td>
                <td>${formatNumber(sumBurden)}원</td>
            </tr>
        </table>

        <p class="print-disclaimer">※ 이 계산 결과는 참고용이며, 실제 신고·공제 금액은 담당 기관 확인에 따라 달라질 수 있습니다. 위 표의 요율은 기본 요율이며, 고용보험은 만 65세 이상이면 고용안정분(0.25%)만 부과됩니다.${anyExempt ? ' 나이(60세/65세) 조건으로 면제된 근로자가 있어 해당 근로자의 실제 금액은 표시된 기본 요율과 다를 수 있습니다(금액 자체는 이미 정확히 반영되어 있습니다).' : ''} 산재보험료는 선택하신 업종 기준 요율로 계산한 참고용 금액입니다. "두루누리 적용 시" 줄은 급여 270만원 이하로 두루누리 지원 가능 대상인 근로자에게 참고로 함께 보여드리는 금액이며, 실제 지원 여부는 근로복지공단 확인이 필요합니다.${ownerCalc ? ' "사업주 본인" 보험료는 국민연금·건강보험·장기요양만 계산했으며(고용보험·산재보험은 사업주 대상이 아니어서 제외), 사업주 부담 합계에는 포함되어 있고 근로자 공제 표에는 포함되지 않습니다.' : ''}</p>
    `;

    printWithFilenameTitle(`4대보험_사업주부담_${dateSlug(today)}`);
}

// 처음부터 다시
function restart() {
    document.getElementById('workerSalary').value = '';
    document.getElementById('workerBirth').value = '';
    document.getElementById('workerInputError').style.display = 'none';
    document.getElementById('workerResultSection').style.display = 'none';

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
    ownerDurunuriApplied = false;
    mwDurunuriApplied = { deduction: {}, burden: {} };

    resetEmployerSubTabs();
    showStep('step2');
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

// PDF 저장(인쇄) 시 파일명 기본값으로 쓰이도록 문서 제목을 잠깐 바꿔서 인쇄 — 아이폰은 "파일에 저장" 시
// 파일명을 직접 입력하는 칸이 없어서, 저장되는 기본 이름이라도 알아보기 쉽게 만들어주는 용도
function printWithFilenameTitle(filenameTitle) {
    const originalTitle = document.title;
    document.title = filenameTitle;
    window.addEventListener('afterprint', () => {
        document.title = originalTitle;
    }, { once: true });

    setTimeout(() => window.print(), 100);
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
    if (type !== 'foreigner') return;
    const expand = document.getElementById('foreignerExpand');
    const btn = document.getElementById('foreignerOptionBtn');
    const isOpen = expand.classList.toggle('open');
    btn.classList.toggle('active', isOpen);
}

// 체류자격 → 국적 순서로 판단해 국민연금 당연적용 여부를 확인
// (체류자격 자체가 제외 대상이면 국적과 무관하게 제외, 아니면 국적이 "사업장·지역 적용제외국"인지만 확인)
function checkForeignerPension() {
    const visaIdx = document.getElementById('foreignerVisa').value;
    const countryIdx = document.getElementById('foreignerCountry').value;
    const resultBox = document.getElementById('foreignerPensionResult');

    if (visaIdx === '' || countryIdx === '') {
        resultBox.style.display = 'block';
        resultBox.innerHTML = '<p class="privacy-note input-error-note">⚠️ 체류자격과 국적을 모두 선택해주세요.</p>';
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

    resultBox.style.display = 'block';
    resultBox.innerHTML = `
        <div class="result-row total ${excluded ? 'result-excluded' : ''}">
            <span>국민연금</span>
            <span>${excluded ? '제외 대상' : '가입 대상'}</span>
        </div>
        <p class="privacy-note">ℹ️ ${reason}</p>
        <p class="privacy-note">※ 이 판단은 2026.3.19. 기준 국가별 연금제도 조사 자료와 2024.4.1. 기준 체류자격별 적용 자료를 바탕으로 한 참고용이며, 실제 적용 여부는 국민연금공단에 별도로 확인해주세요.</p>
    `;
}

// 산재보험 업종 드롭다운은 페이지 로드 시 한 번만 채워두면 됨
// (스크립트 태그가 body 맨 끝에 있어 이 시점엔 이미 DOM이 준비되어 있음)
populateIndustryOptions('multiIndustryType');

// 페이지 로드 시 서비스 워커 등록 (PWA)
window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // 로컬 환경에서는 등록 실패해도 무시
        });
    }
});
