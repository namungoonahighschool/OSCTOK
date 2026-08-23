const SUPABASE_URL = 'https://cyjpwrtlfigclcrtpeym.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Zw8o5lLhqw_a1AMy50ZW9w_UGtkaR6P';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Theme Toggle Engine
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('osctok_theme', newTheme);
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('osctok_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    checkUserSession();
    loadFeed();
});

// Session State & Navigation Control
async function checkUserSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        const userDisplay = document.getElementById('user-display');

        if (session) {
            const authSection = document.getElementById('auth-section');
            if (authSection) authSection.style.display = 'none';
            
            const postSection = document.getElementById('create-post-section');
            if (postSection) postSection.style.display = 'block';

            if (userDisplay) userDisplay.innerHTML = `<button onclick="handleLogout()" style="width:auto; padding:5px 12px; font-size:12px;">Log Out</button>`;

            const settingsLink = document.getElementById('settings-link');
            if (settingsLink) settingsLink.style.display = 'inline';

            const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
            if (profile && profile.is_admin) {
                const adminLink = document.getElementById('admin-link');
                if (adminLink) adminLink.style.display = 'inline';
            }
        }
    } catch (err) {
        console.error("Session check error:", err.message);
    }
}

async function handleSignup() {
    const emailInput = document.getElementById('email').value.trim();
    const passwordInput = document.getElementById('password').value.trim();

    if (!emailInput || !passwordInput) {
        alert('Please enter both an email and a password.');
        return;
    }

    const isAdmin = (passwordInput === 'osctokceo256');

    try {
        const { data, error } = await supabase.auth.signUp({
            email: emailInput,
            password: passwordInput,
            options: { data: { is_admin: isAdmin } }
        });

        if (error) {
            alert('Signup Error: ' + error.message);
            return;
        }

        // Fallback: Manually insert profile if trigger didn't catch it
        if (data && data.user) {
            await supabase.from('profiles').upsert([
                { id: data.user.id, username: emailInput.split('@')[0], is_admin: isAdmin }
            ]);
        }

        alert('Account created successfully! You can now log in.');
        location.reload();
    } catch (err) {
        alert('Unexpected error during signup: ' + err.message);
    }
}

async function handleLogin() {
    const emailInput = document.getElementById('email').value.trim();
    const passwordInput = document.getElementById('password').value.trim();

    if (!emailInput || !passwordInput) {
        alert('Please enter both an email and a password.');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ 
            email: emailInput, 
            password: passwordInput 
        });

        if (error) {
            alert('Login Error: ' + error.message);
            return;
        }

        if (passwordInput === 'osctokceo256' && data && data.user) {
            await supabase.from('profiles').update({ is_admin: true }).eq('id', data.user.id);
        }

        location.reload();
    } catch (err) {
        alert('Unexpected error during login: ' + err.message);
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    location.reload();
}

// Media Post Creation
async function createPost() {
    const text = document.getElementById('post-text').value;
    const fileInput = document.getElementById('media-file');
    const file = fileInput.files[0];
    
    let mediaUrl = null;
    let mediaType = null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please log in to post content.');
    if (!text.trim() && !file) return alert('Post cannot be completely empty.');

    if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `post_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
        if (uploadError) {
            alert('Upload failed: ' + uploadError.message);
            return;
        }

        const { data: publicURLData } = supabase.storage.from('media').getPublicUrl(fileName);
        mediaUrl = publicURLData.publicUrl;

        if (file.type.startsWith('image/')) mediaType = 'image';
        else if (file.type.startsWith('video/')) mediaType = 'video';
        else if (file.type.startsWith('audio/')) mediaType = 'audio';
        else mediaType = 'document';
    }

    const { error } = await supabase.from('posts').insert([
        { user_id: user.id, content: text, media_url: mediaUrl, media_type: mediaType }
    ]);

    if (error) alert('Post creation error: ' + error.message);
    else {
        document.getElementById('post-text').value = '';
        fileInput.value = '';
        loadFeed();
    }
}

// Hashtag formatting
function formatContent(text) {
    if (!text) return '';
    return text.replace(/(#\w+)/g, '<span style="color: var(--accent-color); font-weight:600;">$1</span>');
}

// Interactive Likes
async function likePost(postId, currentLikes) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Log in to like posts.');

    const newLikes = (currentLikes || 0) + 1;
    const { error } = await supabase.from('posts').update({ likes_count: newLikes }).eq('id', postId);
    if (!error) loadFeed();
}

// Feed Rendering Engine
async function loadFeed(searchQuery = '') {
    const feed = document.getElementById('feed');
    if (!feed) return;

    let query = supabase
        .from('posts')
        .select(`*, profiles(username, avatar_url)`)
        .order('created_at', { ascending: false });

    if (searchQuery.trim() !== '') {
        query = query.ilike('content', `%${searchQuery}%`);
    }

    const { data: posts, error } = await query;

    if (error) {
        console.error("Feed load error:", error.message);
        return;
    }

    feed.innerHTML = '';
    if (!posts || posts.length === 0) {
        feed.innerHTML = `<p style="text-align:center; color:var(--secondary-text); padding:20px;">No posts found on OscTok.</p>`;
        return;
    }

    posts.forEach(post => {
        let mediaHtml = '';
        if (post.media_url) {
            if (post.media_type === 'image') mediaHtml = `<img src="${post.media_url}" style="max-width:100%; border-radius:12px; margin-top:10px;">`;
            else if (post.media_type === 'video') mediaHtml = `<video controls src="${post.media_url}" style="max-width:100%; border-radius:12px; margin-top:10px;"></video>`;
            else if (post.media_type === 'audio') mediaHtml = `<audio controls src="${post.media_url}" style="width:100%; margin-top:10px;"></audio>`;
            else mediaHtml = `<a href="${post.media_url}" target="_blank" style="display:block; margin-top:10px; color:var(--accent-color);">📄 Download Attached Document</a>`;
        }

        const avatar = (post.profiles && post.profiles.avatar_url) ? post.profiles.avatar_url : 'https://via.placeholder.com/40';
        const username = post.profiles ? post.profiles.username : 'OscTok User';

        feed.innerHTML += `
            <div class="post">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <img src="${avatar}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
                    <div class="post-header" style="margin:0;">@${username}</div>
                </div>
                <div class="post-content">${formatContent(post.content)}</div>
                ${mediaHtml}
                <div class="actions">
                    <span onclick="likePost('${post.id}', ${post.likes_count})">❤️ ${post.likes_count || 0} Likes</span>
                </div>
            </div>
        `;
    });
}

function handleSearch(query) {
    loadFeed(query);
}
