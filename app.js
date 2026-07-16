/**
 * app.js
 * - 구미 로컬 허브의 상태관리, 사용자 탭 전환, 게시글/댓글 데이터 처리 가공부입니다.
 * - 8대 핵심 라이프스타일 디렉토리 공공데이터셋(directoryItems)이 내장되어 있습니다.
 * - [버그 수정 완료] 댓글 삭제 매칭 로직('==='), 브라우저 경고창 대체 모달 헬퍼 탑재, 카카오 맵 스크립트 중복 웜업 에러 방지
 */

const { createApp, ref, computed, nextTick, onMounted, watch } = Vue;

// ★ [실시간 배포용 API KEY 입력란]
// 가지고 계신 카카오 맵 JavaScript API 키(32자리 영숫자 문자열)를 아래 입력해 주세요.
const DEFAULT_KAKAO_MAP_KEY = "1e59fb079263cc0ecc09b5cb822636e3"; // 여기에 카카오 JavaScript 키를 입력하세요.

createApp({
    setup() {
        // 상단 주요 네비게이션 탭 정보
        const tabs = [
            { id: 'home', name: '홈 대시보드', icon: 'home' },
            { id: 'directory', name: '종합 디렉토리', icon: 'compass' },
            { id: 'board', name: '익명 추천방', icon: 'message-square' },
            { id: 'ai-assistant', name: '구미 AI 비서', icon: 'bot' }
        ];
        
        const currentTab = ref('home');
        const mobileMenuOpen = ref(false);
        const searchQuery = ref('');

        // 커스텀 알림 상태 관리 (alert 대체용)
        const toast = ref({
            show: false,
            title: '',
            message: '',
            type: 'info' // 'info', 'error', 'success'
        });

        // 커스텀 토스트 알림창 헬퍼 함수
        const showToast = (title, message, type = 'success') => {
            toast.value = {
                show: true,
                title,
                message,
                type
            };
            nextTick(() => {
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
            // 4.5초 뒤 자동 종료
            setTimeout(() => {
                toast.value.show = false;
            }, 4500);
        };

        // 구미_경북권 JSON 파일의 contentType과 동일한 8개 분류
        const categories = [
            { id: 'tourism', name: '관광지', icon: 'mountain', desc: '구미·경북권 주요 관광 명소' },
            { id: 'leports', name: '레포츠', icon: 'bike', desc: '수상·육상 레저와 체육 활동' },
            { id: 'culture', name: '문화시설', icon: 'landmark', desc: '공연장, 전시관과 문화 공간' },
            { id: 'shopping', name: '쇼핑', icon: 'shopping-bag', desc: '전통시장과 지역 쇼핑 명소' },
            { id: 'lodging', name: '숙박', icon: 'bed-double', desc: '호텔, 펜션과 지역 숙박시설' },
            { id: 'course', name: '여행코스', icon: 'route', desc: '테마별 추천 여행 동선' },
            { id: 'food', name: '음식점', icon: 'utensils', desc: '구미·경북권 대표 음식점' },
            { id: 'festival', name: '축제공연행사', icon: 'party-popper', desc: '축제, 공연과 지역 행사' }
        ];
        
        // 8대 핵심 분류 중 현재 디렉토리에서 필터링할 테마
        const activeDirectoryCategory = ref('전체');
        const serverDirectoryItems = ref([]);
        const directorySearchLoading = ref(false);
        const directorySearchError = ref('');
        const directorySearchTotal = ref(0);
        const directoryPage = ref(1);
        const PAGE_SIZE = 12;
        let directorySearchTimer = null;
        let directorySearchSequence = 0;

        // 내장 공공데이터셋 (8대 테마 분류에 완전 매칭)
        const directoryItems = ref([
            // [1. 관광지]
            {
                id: 1,
                name: "금오산 도립공원",
                category: "관광지",
                address: "경상북도 구미시 금오산로 400-1",
                desc: "1970년 우리나라 최초의 도립공원으로 지정된 영남의 대표 명산입니다. 기암절벽과 깊은 계곡, 아름다운 산세가 어우러져 사계절 내내 등산객들의 발길이 끊이지 않습니다. 산 정상부에는 약사암과 신라 승려 아도가 창건했다는 도선굴이 있어 경이로운 비경을 선사합니다.",
                tips: ["금오산 케이블카를 이용하면 대혜폭포 인근까지 수월하게 올라갈 수 있습니다.", "매주 주말 가을철에는 조기 만차가 되므로 오전 9시 전 주차장 진입을 추천합니다."],
                tags: ["도립공원", "등산코스", "사찰", "자연경관"]
            },
            {
                id: 2,
                name: "도선굴",
                category: "관광지",
                address: "경상북도 구미시 금오산로 400-1 (대혜폭포 위)",
                desc: "금오산 대혜폭포 근처 깎아지른 듯한 암벽에 위치한 천연 동굴입니다. 신라 말 도선국사가 이곳에서 도를 통하였다고 하여 이름 붙여졌습니다. 굴 내부에서 바라보는 구미시와 낙동강 전경은 액자 속 그림처럼 아름다워 대표적인 사진 명소로 손꼽힙니다.",
                tips: ["올라가는 길이 상당히 가파르고 암반이 미끄러우므로 운동화 착용이 필수입니다.", "비가 내린 직후에는 폭포수 낙수가 멋지나 암벽 낙석에 유의해야 합니다."],
                tags: ["인생샷", "동굴", "풍경맛집", "금오산"]
            },
            // [2. 레포츠]
            {
                id: 3,
                name: "낙동강 수상레포츠 체험센터",
                category: "레포츠",
                address: "경상북도 구미시 수출대로 32-55 (임수동)",
                desc: "낙동강의 넓고 잔잔한 수면 위에서 다양한 무동력 수상레저 기구를 안전하게 즐길 수 있는 가족형 레포츠 복합 센터입니다. 카약, 카누, 패들보드(SUP), 딩기요트 등을 전문 강사의 사전 교육 후 합리적인 비용으로 대여해 직접 체험할 수 있습니다.",
                tips: ["구미시민은 신분증 지참 시 50% 감면 혜택을 받을 수 있습니다.", "구명조끼와 기본 장비는 무상 제공되나, 여벌 옷과 수건은 직접 지참하셔야 합니다."],
                tags: ["수상레저", "카약체험", "패들보드", "액티비티"]
            },
            {
                id: 4,
                name: "구미시 자전거 안전교육장 및 전용 트랙",
                category: "Leisure",
                category: "레포츠",
                address: "경상북도 구미시 양호동 10-1",
                desc: "낙동강 체육공원 내에 조성된 대규모 자전거 트랙과 안전 교육장입니다. 어린아이들이 보조 바퀴 없이 안전하게 주행 연습을 할 수 있는 코스부터, 숙련자를 위한 고속 전용 트랙까지 고루 완비하고 있습니다. 다양한 유형의 자전거를 신분증만 있으면 현장에서 즉시 무료로 대여해 줍니다.",
                tips: ["오후 시간대에는 어린이를 동반한 가족 방문객이 대거 밀리므로 한적하게 타려면 오전 방문을 추천합니다.", "반드시 신분증을 제시해야 자전거 무상 대여가 가능합니다."],
                tags: ["자전거라이딩", "무료대여", "체육공원", "라이딩코스"]
            },
            // [3. 힐링/산책]
            {
                id: 5,
                name: "금오지 수변 산책로 & 올레길",
                category: "힐링/산책",
                address: "경상북도 구미시 금오산로 324 (남통동)",
                desc: "금오산 자락 아래 위치한 드넓은 저수지 둘레를 따라 조성된 약 2.4km의 무장애 데크 산책로입니다. 물 위를 걷는 듯한 수변 올레길과 저수지 중앙을 가로지르는 부교, 그리고 밤이면 감성적인 조명이 들어오는 수변 정자가 어우러져 구미 최고의 연인 밤 산책 데이트 명소로 사랑받고 있습니다.",
                tips: ["완만한 평지로 구성되어 유모차나 휠체어 이용도 무리 없이 가능합니다.", "야간 일몰 직후 조명이 점등되는 시점에 맞춰 방문하면 가장 분위기가 좋습니다."],
                tags: ["올레길", "저수지산책", "야간조명", "데이트코스"]
            },
            {
                id: 6,
                name: "동락공원 밤 산책 코스",
                category: "힐링/산책",
                address: "경상북도 구미시 3공단1로 191 (임수동)",
                desc: "낙동강변을 따라 길게 뻗은 대규모 도심형 테마 공원입니다. 세계 최초의 전자신종이 위치해 있으며, 넓은 잔디광장, 어린이 놀이터, 인라인 스케이트장 등이 조화롭게 흩어져 있습니다. 특히 봄에는 벚꽃 터널이 길게 드리워져 구미를 대표하는 분홍빛 힐링 구역으로 변모합니다.",
                tips: ["공원 내 민속관 구역에서 전통 그네 뛰기와 전통 가옥 형태를 구경할 수 있습니다.", "공원 면적이 매우 넓어 걷기 힘들 수 있으니 자전거를 이용해 이동하는 것도 추천합니다."],
                tags: ["벚꽃명소", "가족소풍", "낙동강변", "피크닉"]
            },
            // [4. 문화예술]
            {
                id: 7,
                name: "구미시 문화예술회관",
                category: "문화예술",
                address: "경상북도 구미시 송정대로 43",
                desc: "구미를 대표하는 복합 문화 예술 복합 시설로, 뮤지컬, 클래식 콘서트, 전통 국악 공연, 정기 미술 전시회 등 영남권 시민들에게 폭넓은 문화 향유 기회를 선사하는 역사적인 무대입니다. 현대적인 대공연장과 소공연장 및 다목적 갤러리가 연중 다채롭게 운영됩니다.",
                tips: ["회관 홈페이지를 통해 유료/무료 상설 기획 전시 일정을 미리 점검한 뒤 방문하세요.", "회관 주변에 주차 공간이 넉넉하나, 대형 공연이 있는 날에는 대중교통이 안전합니다."],
                tags: ["미술전시", "뮤지컬공연", "연주회", "문화생활"]
            },
            // [5. 쇼핑/전통시장]
            {
                id: 8,
                name: "구미 새마을중앙시장 (국수 골목)",
                category: "쇼핑/전통시장",
                address: "경상북도 구미시 산업로2길 48 (원평동)",
                desc: "구미역 바로 앞에 위치한 활기 넘치는 대표적인 상설 전통시장입니다. 깨끗하게 비가림 아케이드 시설이 완비되어 쾌적하게 쇼핑할 수 있으며, 백종원 방송에도 소개된 쫄깃하고 가성비 훌륭한 '국수 골목'과 옛날식 떡볶이, 수제 족발 골목 등 서민적인 맛집들이 오밀조밀 모여 있습니다.",
                tips: ["시장 공영 주차장 이용 시 시장 상인들에게 주차 할인권을 요청하여 적용받으세요.", "국수 골목은 푸짐한 양에 비해 가격이 매우 저렴해 현금이나 온누리상품권을 지참하면 좋습니다."],
                tags: ["전통시장", "가성비맛집", "국수골목", "온누리상품권"]
            },
            // [6. 자연/캠핑]
            {
                id: 9,
                name: "낙동강 체육공원 캠핑장",
                category: "자연/캠핑",
                address: "경상북도 구미시 낙동강변로 820",
                desc: "낙동강변의 탁 트인 대자연 속에서 캠핑을 즐길 수 있는 최고의 캠핑존입니다. 오토캠핑 사이트뿐만 아니라 일반 잔디 캠핑존, 대형 카라반 사이트가 고루 정비되어 있습니다. 공원 내 체육시설(축구장, 풋살장 등)과 어린이 모래 놀이터 등이 함께 붙어 있어 가족 단위 오토캠핑 족들에게 천국 같은 공간입니다.",
                tips: ["인기 캠핑존이기 때문에 매월 초 진행되는 온라인 사전 예약 시스템 경쟁이 매우 치열합니다.", "주변에 대형 마트가 없어 입실 전에 먹거리와 생필품을 미리 충분히 쇼핑해 오는 것을 권장합니다."],
                tags: ["오토캠핑", "낙동강", "카라반", "가족캠핑"]
            },
            // [7. 역사/유적]
            {
                id: 10,
                name: "구미 야은 채미정",
                category: "역사/유적",
                address: "경상북도 구미시 금오산로 360",
                desc: "고려 말의 충신이자 삼은(三隱) 중 한 분인 야은 길재 선생의 충절과 학문을 기리기 위해 조선 영조 시대에 건립된 아름다운 누각입니다. 금오산 진입 길목 계곡 옆에 오롯이 자리 잡아, 계곡물 소리와 고풍스러운 한옥 정자, 주변의 수려한 느티나무 숲이 한 폭의 동양화처럼 수려하게 정취를 자아냅니다.",
                tips: ["정자 뒤편 산책로를 가볍게 걸으면 기도가 잘 된다는 바위 틈 작은 샘터가 나타납니다.", "가을철 단풍이 절정일 때 채미정 뒤편 한옥 지붕과 알록달록한 단풍이 조화를 이루어 최고의 출사 포인트를 선물합니다."],
                tags: ["야은길재", "한옥정자", "문화재", "단풍명소"]
            },
            // [8. 테마체험]
            {
                id: 11,
                name: "구미시 과학관 & 어린이 과학 놀이터",
                category: "테마체험",
                address: "경상북도 구미시 3공단1로 191-1 (동락공원 내)",
                desc: "동락공원 중심부에 완비된 유아 및 초등학생 타겟의 과학 테마 학습관입니다. 기초 과학의 흥미로운 현상들을 직접 만지고 조작하며 체험하는 실물 기초과학 전시존, 그리고 돔 스크린을 통해 밤하늘의 우주 별자리를 감상하는 천체 투영관이 매우 인기 있게 운영되고 있습니다.",
                tips: ["천체 투영 상영 시간표를 미리 파악하고 현장 매표를 조기 신청해야 천체 돔 관람이 가능합니다.", "초등생 저학년 자녀들에게 가장 유용한 체험 중심 시설입니다."],
                tags: ["천체투영", "과학관", "어린이체험", "교육시설"]
            }
        ]);

        // [ computed ] 검색어 및 선택된 카테고리를 적용한 종합 디렉토리 목록 필터링
        const filteredDirectoryItems = computed(() => {
            const query = searchQuery.value.trim();
            const source = query ? serverDirectoryItems.value : directoryItems.value;
            return source.filter(item => {
                const matchCategory = (activeDirectoryCategory.value === '전체' || item.category === activeDirectoryCategory.value);
                return matchCategory;
            });
        });

        const directoryTotalItems = computed(() =>
            searchQuery.value.trim() ? directorySearchTotal.value : filteredDirectoryItems.value.length
        );
        const directoryTotalPages = computed(() => Math.max(1, Math.ceil(directoryTotalItems.value / PAGE_SIZE)));
        const paginatedDirectoryItems = computed(() => {
            if (searchQuery.value.trim()) return filteredDirectoryItems.value;
            const start = (directoryPage.value - 1) * PAGE_SIZE;
            return filteredDirectoryItems.value.slice(start, start + PAGE_SIZE);
        });

        // [모달 1] 상세 보기 모달 관련 바인딩
        const detailModalOpen = ref(false);
        const selectedItem = ref(null);

        const openDetailModal = (item) => {
            selectedItem.value = item;
            detailModalOpen.value = true;
            nextTick(() => {
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        };

        const closeDetailModal = () => {
            detailModalOpen.value = false;
            selectedItem.value = null;
        };

        // 이미지 로드 예외 처리 헬퍼
        const handleImageError = (e) => {
            e.target.src = "https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?w=500&auto=format&fit=crop&q=60";
        };

        const normalizeLocation = (location) => ({
            ...location,
            name: location.title,
            desc: location.overview || '',
            address: location.address || '',
            tags: [location.category, location.source].filter(Boolean),
            firstimage: location.image_url || location.thumbnail_url || '',
            mapx: location.longitude,
            mapy: location.latitude
        });

        const fetchDirectoryItems = async () => {
            try {
                const locations = await GumiApi.getAllLocations();
                if (!locations.length) return;
                directoryItems.value = locations.map(normalizeLocation);
            } catch (error) {
                console.warn('장소 API를 불러오지 못해 내장 데이터를 사용합니다.', error);
            }
        };

        const searchDirectoryFromServer = async () => {
            const query = searchQuery.value.trim();
            if (!query) {
                serverDirectoryItems.value = [];
                directorySearchTotal.value = 0;
                directorySearchError.value = '';
                directorySearchLoading.value = false;
                return;
            }

            const sequence = ++directorySearchSequence;
            directorySearchLoading.value = true;
            directorySearchError.value = '';
            try {
                const result = await GumiApi.searchLocations(query, activeDirectoryCategory.value, directoryPage.value, PAGE_SIZE);
                if (sequence !== directorySearchSequence) return;
                serverDirectoryItems.value = (result?.items || []).map(normalizeLocation);
                directorySearchTotal.value = Number(result?.total || serverDirectoryItems.value.length);
            } catch (error) {
                if (sequence !== directorySearchSequence) return;
                serverDirectoryItems.value = [];
                directorySearchTotal.value = 0;
                directorySearchError.value = '장소 검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
            } finally {
                if (sequence === directorySearchSequence) directorySearchLoading.value = false;
            }
        };


        // ==========================================
        //  익명추천방 (게시판) 상태 관리 및 통신
        // ==========================================
        const boardPosts = ref([]);
        const showCreateForm = ref(false);
        const boardSearchQuery = ref('');
        const boardPage = ref(1);

        // 백엔드가 아직 제공하지 않는 화면 전용 필드(닉네임/좋아요/댓글)를 보관합니다.
        const BOARD_META_KEY = 'localhub_board_meta_v1';
        const readBoardMeta = () => {
            try { return JSON.parse(localStorage.getItem(BOARD_META_KEY) || '{}'); }
            catch { return {}; }
        };
        const writeBoardMeta = (meta) => localStorage.setItem(BOARD_META_KEY, JSON.stringify(meta));
        const mergePostMeta = (post) => GumiApi.normalizePost(post, readBoardMeta()[post.id] || {});
        const savePostMeta = (postId, changes) => {
            const meta = readBoardMeta();
            meta[postId] = { ...(meta[postId] || {}), ...changes };
            writeBoardMeta(meta);
            return meta[postId];
        };

        const newPost = ref({
            nickname: '',
            password: '',
            title: '',
            content: ''
        });

        // 게시글 모달 제어
        const postDetailModalOpen = ref(false);
        const selectedPost = ref(null);

        // 글 및 댓글 삭제 비밀번호 팝업 창 정보
        const passwordCheckOpen = ref(false);
        const targetPostIdForDelete = ref(null);
        const deletePasswordInput = ref('');
        const deleteErrorMsg = ref('');

        const deleteCommentCheckOpen = ref(false);
        const targetPostIdForCommentDelete = ref(null);
        const targetCommentIdForDelete = ref(null);
        const deleteCommentPasswordInput = ref('');
        const deleteCommentErrorMsg = ref('');

        // 새 댓글 바인딩
        const newComment = ref({
            nickname: '',
            password: '',
            content: ''
        });

        // 백엔드 데이터 동적 수집 (onMounted에서 호출)
        const fetchBoardPosts = async () => {
            try {
                const posts = await GumiApi.getAllPosts();
                boardPosts.value = posts.map(mergePostMeta);
            } catch (err) {
                console.error("추천글 데이터를 수신할 수 없습니다.", err);
                showToast("데이터 수신 오류", "백엔드 API 서버가 현재 대기 상태이거나 주소가 유효하지 않습니다. 잠시 후 재시도 해주세요.", "error");
            }
        };

        // 전체 게시물 필터링 연산
        const filteredBoardPosts = computed(() => {
            return boardPosts.value.filter(post => {
                const query = boardSearchQuery.value.trim().toLowerCase();
                if (!query) return true;
                return (
                    (post.title && post.title.toLowerCase().includes(query)) ||
                    (post.content && post.content.toLowerCase().includes(query)) ||
                    (post.nickname && post.nickname.toLowerCase().includes(query)) ||
                    (post.placeName && post.placeName.toLowerCase().includes(query))
                );
            });
        });
        const boardTotalPages = computed(() => Math.max(1, Math.ceil(filteredBoardPosts.value.length / PAGE_SIZE)));
        const paginatedBoardPosts = computed(() => {
            const start = (boardPage.value - 1) * PAGE_SIZE;
            return filteredBoardPosts.value.slice(start, start + PAGE_SIZE);
        });

        const getPageNumbers = (current, total) => {
            const start = Math.max(1, Math.min(current - 2, total - 4));
            const end = Math.min(total, start + 4);
            return Array.from({ length: end - start + 1 }, (_, index) => start + index);
        };
        const directoryPageNumbers = computed(() => getPageNumbers(directoryPage.value, directoryTotalPages.value));
        const boardPageNumbers = computed(() => getPageNumbers(boardPage.value, boardTotalPages.value));

        // 홈화면용 최신 글 5개 피드 추출
        const recentPosts = computed(() => {
            return [...boardPosts.value]
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 5);
        });

        // 글 상세 보기 팝업
        const openPostDetail = async (postOrId) => {
            const postId = typeof postOrId === 'object' ? postOrId.id : postOrId;
            try {
                selectedPost.value = mergePostMeta(await GumiApi.getPostById(postId));
                postDetailModalOpen.value = true;
                nextTick(() => {
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                });
            } catch (err) {
                showToast("불러오기 실패", "해당 글 정보를 찾지 못했습니다.", "error");
            }
        };

        // 추천 게시글 등록 처리
        const submitPost = async () => {
            if (!newPost.value.nickname.trim()) return showToast("입력 오류", "익명 닉네임을 입력하세요.", "error");
            if (!newPost.value.password.trim() || newPost.value.password.length < 4) {
                return showToast("입력 오류", "삭제 비밀번호는 최소 4글자 이상 설정하세요.", "error");
            }
            if (!newPost.value.title.trim()) return showToast("입력 오류", "글 제목을 적어주세요.", "error");
            if (!newPost.value.content.trim()) return showToast("입력 오류", "상세 추천 사유 내용을 적어주세요.", "error");

            try {
                const created = await GumiApi.createPost(newPost.value);
                savePostMeta(created.id, {
                    nickname: newPost.value.nickname,
                    likes: 0,
                    comments: []
                });
                showToast("작성 완료", "추천 명소가 성공적으로 익명게시판에 제보되었습니다!", "success");
                
                newPost.value = { nickname: '', password: '', title: '', content: '' };
                showCreateForm.value = false;
                
                // 최신 데이터 동기화
                await fetchBoardPosts();
            } catch (err) {
                showToast("등록 실패", "추천 제보 저장 중 통신 에러가 발생했습니다.", "error");
            }
        };

        // 추천 게시글 좋아요 공감
        const likePost = (postId) => {
            const post = boardPosts.value.find(p => p.id === postId) || selectedPost.value;
            if (!post) return;
            const likes = Number(post.likes || 0) + 1;
            savePostMeta(postId, { likes });
            post.likes = likes;
            if (selectedPost.value?.id === postId) selectedPost.value.likes = likes;
            showToast("공감 반영", "이 브라우저에 공감이 저장되었습니다.", "success");
        };

        // 게시글 삭제 대화상자 띄우기
        const triggerDelete = (postOrId) => {
            const postId = typeof postOrId === 'object' ? postOrId.id : postOrId;
            targetPostIdForDelete.value = postId;
            deletePasswordInput.value = '';
            deleteErrorMsg.value = '';
            passwordCheckOpen.value = true;
            nextTick(() => {
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        };

        const closeDeleteDialog = () => {
            passwordCheckOpen.value = false;
            targetPostIdForDelete.value = null;
        };

        // 게시물 삭제 연동 확정
        const confirmDeletePost = async () => {
            if (!deletePasswordInput.value.trim()) {
                deleteErrorMsg.value = "비밀번호를 입력해 주세요.";
                return;
            }
            try {
                await GumiApi.deletePost(targetPostIdForDelete.value, deletePasswordInput.value);
                showToast("삭제 성공", "추천 게시글이 깨끗하게 삭제되었습니다.", "success");
                
                passwordCheckOpen.value = false;
                postDetailModalOpen.value = false; // 보던 모달도 함께 닫기
                
                await fetchBoardPosts();
            } catch (err) {
                deleteErrorMsg.value = "비밀번호가 다르거나 서버가 작업을 거부했습니다.";
            }
        };

        // ==========================================
        //  게시판 하위 - 댓글 구현 기능
        // ==========================================
        const submitComment = async (postId) => {
            if (!newComment.value.nickname.trim()) return showToast("댓글 실패", "댓글 작성자 닉네임을 기입하세요.", "error");
            if (!newComment.value.password.trim()) return showToast("댓글 실패", "댓글 비밀번호를 입력하세요.", "error");
            if (!newComment.value.content.trim()) return showToast("댓글 실패", "댓글 내용을 입력해 주세요.", "error");

            try {
                const comments = [...(selectedPost.value.comments || []), {
                    id: `${Date.now()}`,
                    nickname: newComment.value.nickname,
                    password: newComment.value.password,
                    content: newComment.value.content,
                    date: new Date().toLocaleDateString('ko-KR')
                }];
                savePostMeta(postId, { comments });
                selectedPost.value.comments = comments;
                
                // 댓글 인풋 리셋
                newComment.value = { nickname: '', password: '', content: '' };
                showToast("댓글 등록", "소중한 댓글 피드백이 추가되었습니다.", "success");
                
                // 보드 목록도 함께 댓글수 갱신되도록 동화
                await fetchBoardPosts();
            } catch (err) {
                showToast("댓글 저장 불가", "서버 환경 오류로 댓글을 등록하지 못했습니다.", "error");
            }
        };

        const triggerDeleteComment = (postId, commentId) => {
            targetPostIdForCommentDelete.value = postId;
            targetCommentIdForDelete.value = commentId;
            deleteCommentPasswordInput.value = '';
            deleteCommentErrorMsg.value = '';
            deleteCommentCheckOpen.value = true;
            nextTick(() => {
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        };

        const closeDeleteCommentDialog = () => {
            deleteCommentCheckOpen.value = false;
            targetPostIdForCommentDelete.value = null;
            targetCommentIdForDelete.value = null;
        };

        // [버그 수정 완료] 기존 !== 조건문을 === 조건문으로 교체하여 삭제 시 패스워드를 온전히 검증함
        const confirmDeleteComment = async () => {
            if (!deleteCommentPasswordInput.value.trim()) {
                deleteCommentErrorMsg.value = "비밀번호를 기입해 주십시오.";
                return;
            }

            const postId = targetPostIdForCommentDelete.value;
            const post = boardPosts.value.find(p => p.id === postId) || selectedPost.value;
            if (!post) {
                deleteCommentErrorMsg.value = "연동할 오리지널 게시글을 찾을 수 없습니다.";
                return;
            }

            // 정확히 지우고자 하는 댓글을 매칭 (기존 !== 버그 완전 수정)
            const comment = post.comments.find(c => c.id === targetCommentIdForDelete.value);
            if (!comment) {
                deleteCommentErrorMsg.value = "해당하는 일치 단일 댓글이 존재하지 않습니다.";
                return;
            }

            if (comment.password !== deleteCommentPasswordInput.value) {
                deleteCommentErrorMsg.value = "비밀번호가 올바르지 않습니다.";
                return;
            }

            try {
                const comments = post.comments.filter(c => c.id !== targetCommentIdForDelete.value);
                savePostMeta(postId, { comments });
                if (selectedPost.value?.id === postId) selectedPost.value.comments = comments;
                showToast("댓글 제거 성공", "요청하신 익명 댓글 피드백이 안전하게 정리되었습니다.", "success");
                closeDeleteCommentDialog();
                await fetchBoardPosts();
            } catch (err) {
                deleteCommentErrorMsg.value = "서버 통신 실패 또는 비밀번호 오류입니다.";
            }
        };


        // ==========================================
        //  지도 보기 및 카카오맵 동적 SDK 컴파일
        // ==========================================
        const mapModalOpen = ref(false);
        const activeMapItem = ref(null);
        const isMapLoaded = ref(false);
        const apiKeyModalOpen = ref(false);
        const tempApiKey = ref('');
        const fallbackCoords = { x: '50%', y: '50%' };

        // 카카오 주소->좌표 검색 대처 지오코더 보관소
        let geocoderInstance = null;

        const showMapLocation = (item) => {
            activeMapItem.value = item;
            mapModalOpen.value = true;
            isMapLoaded.value = false;
            apiKeyModalOpen.value = false;

            nextTick(() => {
                if (typeof lucide !== 'undefined') lucide.createIcons();
                // 1. 현재 로컬 스토리지에 기 등록 저장된 키가 존재하는지 1차 우선순위 체크
                const savedKey = DEFAULT_KAKAO_MAP_KEY || localStorage.getItem('gumi_kakao_map_key');
                if (!savedKey) {
                    // 키가 없으면 키 등록 가이드 출력
                    apiKeyModalOpen.value = true;
                    initFallbackMap();
                } else {
                    loadKakaoMapScript(savedKey);
                }
            });
        };

        // 카카오 지도 스크립트 중복 방지 및 안전 로드 구현
        const loadKakaoMapScript = (apiKey) => {
            // 이미 카카오 오브젝트 및 맵 클래스가 있다면 로드 스킵 후 바로 그림
            if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
                renderActualKakaoMap();
                return;
            }

            // 만약 스크립트 태그가 이미 존재한다면 대기 로직 적용
            const existingScript = document.getElementById('kakao-map-sdk');
            if (existingScript) {
                // 이미 선언되었으나 로드 완료가 덜 된 경우, 인터벌 대기
                let checkTimer = setInterval(() => {
                    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
                        clearInterval(checkTimer);
                        renderActualKakaoMap();
                    }
                }, 100);
                return;
            }

            // 신규 로드
            const script = document.createElement('script');
            script.id = 'kakao-map-sdk';
            script.type = 'text/javascript';
            script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services&autoload=false`;
            
            script.onload = () => {
                if (!window.kakao?.maps) {
                    showToast("지도 인증 실패", "카카오맵 사용 설정과 JavaScript SDK 도메인을 확인해 주세요.", "error");
                    initFallbackMap();
                    return;
                }
                window.kakao.maps.load(renderActualKakaoMap);
            };
            
            script.onerror = () => {
                showToast("지도로딩 지연", "카카오 맵 API 키 유효성 오류로 접속이 어렵습니다. 커스텀 키를 입력해 주세요.", "error");
                apiKeyModalOpen.value = true;
                initFallbackMap();
            };

            document.head.appendChild(script);
        };

        // 수동 API 키 갱신 및 연동
        const saveAndLoadKakaoMap = () => {
            const key = tempApiKey.value.trim();
            if (!key || key.length < 10) {
                return showToast("형식 오류", "정상적인 카카오맵 자바스크립트 키 값을 다시 확인하세요.", "error");
            }
            localStorage.setItem('gumi_kakao_map_key', key);
            apiKeyModalOpen.value = false;
            loadKakaoMapScript(key);
        };

        // 실제 지오코더 구동 및 카카오 마커 맵 표출
        const renderActualKakaoMap = () => {
            try {
                const container = document.getElementById('kakao-map-canvas');
                if (!container) return;

                const address = activeMapItem.value?.address || "경상북도 구미시 송정대로 55";
                const placeName = activeMapItem.value?.name || "구미 명소";

                const latitude = Number(activeMapItem.value?.mapy);
                const longitude = Number(activeMapItem.value?.mapx);

                const drawMap = (coords) => {
                    container.innerHTML = '';
                    container.style.display = 'block';
                    const map = new kakao.maps.Map(container, { center: coords, level: 4 });
                    const marker = new kakao.maps.Marker({ map, position: coords });
                    const safePlaceName = String(placeName)
                        .replaceAll('&', '&amp;')
                        .replaceAll('<', '&lt;')
                        .replaceAll('>', '&gt;')
                        .replaceAll('"', '&quot;')
                        .replaceAll("'", '&#039;');
                    const infowindow = new kakao.maps.InfoWindow({
                        content: `<div style="width:180px;text-align:center;padding:8px;font-size:12px;font-weight:700;color:#1e293b;">${safePlaceName}</div>`
                    });
                    infowindow.open(map, marker);
                    isMapLoaded.value = true;
                    requestAnimationFrame(() => {
                        map.relayout();
                        map.setCenter(coords);
                    });
                };

                // JSON/백엔드의 위도·경도가 있으면 주소 검색 없이 바로 표시합니다.
                if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                    drawMap(new kakao.maps.LatLng(latitude, longitude));
                    return;
                }

                // 좌표가 없는 데이터만 주소 검색으로 보완합니다.
                const geocoder = new kakao.maps.services.Geocoder();
                geocoder.addressSearch(address, (result, status) => {
                    if (status === kakao.maps.services.Status.OK) {
                        drawMap(new kakao.maps.LatLng(result[0].y, result[0].x));
                    } else {
                        initFallbackMap();
                    }
                });
            } catch (err) {
                console.error("카카오맵 초기화 에러", err);
                initFallbackMap();
            }
        };

        // 카카오 지도 실패 시 폴백 모드 브라우저 상 표기
        const initFallbackMap = () => {
            isMapLoaded.value = true; // 대기상태 인디케이터 해제
            const container = document.getElementById('kakao-map-canvas');
            if (container) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full bg-slate-50 border p-4 text-center space-y-1">
                        <p class="text-xs font-bold text-slate-800">지도를 표시할 수 없습니다.</p>
                        <p class="text-[10px] text-slate-400">API 키 미등록 상태이거나, 오프라인 상태입니다.</p>
                        <p class="text-[10px] text-blue-600 underline font-medium cursor-pointer" onclick="window.open('https://map.kakao.com/?q=${encodeURIComponent(activeMapItem.value?.address || '')}', '_blank')">
                            👉 대신 카카오웹지도로 바로보기 가기
                        </p>
                    </div>
                `;
            }
        };

        const closeMapModal = () => {
            mapModalOpen.value = false;
        };

        const closeMapModalAndOpenDetail = () => {
            const temp = activeMapItem.value;
            closeMapModal();
            if (temp) {
                openDetailModal(temp);
            }
        };


        // ==========================================
        //  AI 로컬 비서 기능 구현부
        // ==========================================
        const chatMessages = ref([]);
        const userMessage = ref('');
        const isAiLoading = ref(false);
        const chatContainer = ref(null);

        const promptSuggestions = [
            "금오산 케이블카 정보랑 가격 알려줘",
            "동락공원에 벚꽃 구경하기 좋은 코스는?",
            "구미 새마을중앙시장 대표 맛집들을 추천해줘",
            "가족들과 함께 가기 좋은 오토캠핑장이 있어?"
        ];

        const useSuggestion = (text) => {
            userMessage.value = text;
            currentTab.value = 'ai-assistant';
            nextTick(() => {
                sendMessage();
            });
        };

        const clearMessages = () => {
            chatMessages.value = [];
            showToast("초기화 완료", "AI 비서와의 이전 대화 기록이 완전히 소거되었습니다.", "success");
        };

        const sendMessage = async () => {
            const text = userMessage.value.trim();
            if (!text || isAiLoading.value) return;

            // 유저 톡 추가
            chatMessages.value.push({ role: 'user', content: text });
            userMessage.value = '';
            isAiLoading.value = true;
            scrollChatToBottom();

            try {
                // api.js의 sendAiMessage 사용
                const reply = await GumiApi.sendAiMessage(text);
                chatMessages.value.push({ role: 'assistant', content: reply });
            } catch (err) {
                chatMessages.value.push({ 
                    role: 'assistant',
                    content: "죄송합니다. 현재 인공지능 서버 통신에 일시적 장애가 발생했습니다. 잠시 후 다시 질문해 주세요."
                });
            } finally {
                isAiLoading.value = false;
                scrollChatToBottom();
            }
        };

        const scrollChatToBottom = () => {
            nextTick(() => {
                if (chatContainer.value) {
                    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        };

        // 홈화면이나 챗봇에서 타 카테고리로 빠르게 점프이동하는 편의 기능
        const goToCategory = (categoryName) => {
            activeDirectoryCategory.value = categoryName;
            currentTab.value = 'directory';
        };

        // 라이프사이클 마운트 시점 데이터 로드
        onMounted(() => {
            fetchBoardPosts();
            fetchDirectoryItems();
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });

        // 탭 전환 감시 및 동적 아이콘 드로잉 갱신
        watch(currentTab, (newTab) => {
            nextTick(() => {
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        });

        // 검색 결과/초기화 버튼이 동적으로 나타날 때 아이콘을 다시 그립니다.
        watch(boardSearchQuery, () => {
            boardPage.value = 1;
            nextTick(() => {
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        });

        // 장소명/카테고리 변경 후 350ms 동안 입력이 없을 때 서버 검색을 실행합니다.
        watch([searchQuery, activeDirectoryCategory], () => {
            directoryPage.value = 1;
            clearTimeout(directorySearchTimer);
            directorySearchSequence += 1; // 이전 검색 응답을 즉시 무효화
            if (!searchQuery.value.trim()) {
                searchDirectoryFromServer();
                return;
            }
            directorySearchLoading.value = true;
            directorySearchTimer = setTimeout(searchDirectoryFromServer, 350);
        });

        watch(directoryPage, () => {
            if (searchQuery.value.trim()) searchDirectoryFromServer();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        watch(boardPage, () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        watch(directoryTotalPages, total => {
            if (directoryPage.value > total) directoryPage.value = total;
        });
        watch(boardTotalPages, total => {
            if (boardPage.value > total) boardPage.value = total;
        });

        return {
            tabs,
            currentTab,
            mobileMenuOpen,
            searchQuery,
            categories,
            activeDirectoryCategory,
            directoryItems,
            filteredDirectoryItems,
            paginatedDirectoryItems,
            directoryPage,
            directoryTotalPages,
            directoryPageNumbers,
            directorySearchLoading,
            directorySearchError,
            directorySearchTotal,
            
            // 토스트 알림바
            toast,
            showToast,

            // 모달 관리
            detailModalOpen,
            selectedItem,
            openDetailModal,
            closeDetailModal,
            handleImageError,
            
            // 익명추천방 게시판
            boardPosts,
            showCreateForm,
            boardSearchQuery,
            newPost,
            filteredBoardPosts,
            paginatedBoardPosts,
            boardPage,
            boardTotalPages,
            boardPageNumbers,
            recentPosts,
            openPostDetail,
            postDetailModalOpen,
            selectedPost,
            submitPost,
            likePost,
            triggerDelete,
            passwordCheckOpen,
            deletePasswordInput,
            deleteErrorMsg,
            closeDeleteDialog,
            confirmDeletePost,

            // 댓글 기능 바인딩
            newComment,
            submitComment,
            triggerDeleteComment,
            deleteCommentCheckOpen,
            deleteCommentPasswordInput,
            deleteCommentErrorMsg,
            closeDeleteCommentDialog,
            confirmDeleteComment,

            // 지도 모달 및 API 상태
            mapModalOpen,
            activeMapItem,
            isMapLoaded,
            apiKeyModalOpen,
            tempApiKey,
            saveAndLoadKakaoMap,
            showMapLocation,
            closeMapModal,
            closeMapModalAndOpenDetail,
            fallbackCoords,

            // AI 기능
            chatMessages,
            userMessage,
            isAiLoading,
            chatContainer,
            promptSuggestions,
            useSuggestion,
            clearMessages,
            sendMessage,
            goToCategory
        };
    }
}).mount('#app');
