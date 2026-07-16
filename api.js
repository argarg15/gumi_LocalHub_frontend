/** LocalHub backend client. */
const GumiApi = {
    baseUrl: '/api',
    timeoutMs: 30000,

    async request(path, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(`${this.baseUrl}${path}`, {
                ...options,
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                    ...options.headers
                }
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                const message = payload?.message || payload?.detail || `HTTP ${response.status}`;
                throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
            }
            return payload;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('서버 응답 시간이 초과되었습니다.');
            throw error;
        } finally {
            clearTimeout(timer);
        }
    },

    normalizePost(post, extra = {}) {
        const createdAt = post.created_at || post.createdAt;
        return {
            ...post,
            ...extra,
            id: post.id,
            nickname: extra.nickname || post.nickname || '익명',
            likes: Number(post.likes ?? post.like_count ?? 0),
            views: Number(post.views ?? post.view_count ?? 0),
            commentCount: Number(post.comment_count ?? 0),
            comments: post.comments || [],
            createdAt,
            date: createdAt ? new Date(createdAt).toLocaleDateString('ko-KR') : ''
        };
    },

    normalizeComment(comment) {
        const createdAt = comment.created_at || comment.createdAt;
        return {
            ...comment,
            id: comment.id,
            postId: comment.post_id,
            nickname: comment.nickname || '익명',
            createdAt,
            date: createdAt ? new Date(createdAt).toLocaleDateString('ko-KR') : ''
        };
    },

    async getAllPosts(size = 100) {
        const first = await this.request(`/posts?page=1&size=${size}`);
        const totalPages = Math.ceil((first?.total || 0) / size);
        const rest = totalPages > 1
            ? await Promise.all(
                Array.from({ length: totalPages - 1 }, (_, index) =>
                    this.request(`/posts?page=${index + 2}&size=${size}`)
                )
            )
            : [];
        return [...(first?.items || []), ...rest.flatMap(page => page.items || [])]
            .map(post => this.normalizePost(post));
    },

    async getPostById(postId) {
        return this.normalizePost(await this.request(`/posts/${postId}`));
    },

    async createPost(post) {
        const created = await this.request('/posts', {
            method: 'POST',
            body: JSON.stringify({ title: post.title, content: post.content, password: post.password })
        });
        return this.normalizePost(created, { nickname: post.nickname });
    },

    async deletePost(postId, password) {
        return this.request(`/posts/${postId}`, {
            method: 'DELETE',
            body: JSON.stringify({ password })
        });
    },

    async likePost(postId) {
        return this.request(`/posts/${postId}/like`, { method: 'POST' });
    },

    async getComments(postId, page = 1, size = 100) {
        const data = await this.request(`/posts/${postId}/comments?page=${page}&size=${size}`);
        return (data?.items || []).map(comment => this.normalizeComment(comment));
    },

    async createComment(postId, comment) {
        const created = await this.request(`/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({
                nickname: comment.nickname,
                password: comment.password,
                content: comment.content
            })
        });
        return this.normalizeComment(created);
    },

    async deleteComment(postId, commentId, password) {
        return this.request(`/posts/${postId}/comments/${commentId}`, {
            method: 'DELETE',
            body: JSON.stringify({ password })
        });
    },

    async getLocations(page = 1, size = 100) {
        const data = await this.request(`/locations?page=${page}&size=${size}`);
        return data?.items || [];
    },

    async searchLocations(query, category = '', page = 1, size = 100) {
        const params = new URLSearchParams({
            query: query.trim(),
            page: String(page),
            size: String(size)
        });
        if (category && category !== '전체') params.set('category', category);
        return this.request(`/locations?${params.toString()}`);
    },

    async getAllLocations(size = 100) {
        const first = await this.request(`/locations?page=1&size=${size}`);
        const totalPages = Math.ceil((first?.total || 0) / size);
        if (totalPages <= 1) return first?.items || [];
        const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, index) =>
                this.request(`/locations?page=${index + 2}&size=${size}`)
            )
        );
        return [...(first.items || []), ...rest.flatMap(page => page.items || [])];
    },

    async sendAiMessage(message) {
        const data = await this.request('/chat', {
            method: 'POST',
            body: JSON.stringify({ message })
        });
        return data?.answer || data?.reply || data?.response || '응답 내용이 없습니다.';
    }
};
