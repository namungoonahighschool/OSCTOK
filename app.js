const SUPABASE_URL = 'https://cyjpwrtlfigclcrtpeym.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Zw8o5lLhqw_a1AMy50ZW9w_UGtkaR6P';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check Session & Control UI States
async function checkUserSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const authSection = document.getElementById('auth-section');
        if (authSection) authSection.style.display = 'none';
        
        const postSection = document.getElementById('create-post-section');
        if (postSection) postSection.style.display = 'block';

        const authNav = document.getElementById('auth-nav');
        if (authNav) authNav.innerHTML = `<button onclick="handleLogout()" style="width:auto; padding:5px 15px;">Log Out</button>`;

        // Check if user is admin to display dashboard navigation link
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
        if (profile && profile.is_admin) {
            const adminLink = document.getElementById('admin-link');
            if (adminLink) adminLink.style.display = 'inline';
        }
    }
}

async function handleSignup() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Auto-detect if user typed the designated admin password
    const isAdmin = (password === 'osctokceo256');

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { is_admin: isAdmin }
        }
    });

    if (error) alert(error.message);
    else {
        alert('Signup successful! You can now log in.');
        if (isAdmin) alert('Admin credentials detected! You will have administrative permissions.');
    }
}

async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert(error.message);
    } else {
        // Force admin sync if password matches master code
        if (password === 'osctokceo256') {
            await supabase.from('profiles').update({ is_admin: true }).eq('id', data.user.id);
        }
        alert('Logged in successfully!');
        location.reload();
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
    if (!user) return alert('You must be logged in to post.');

    if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
        if (uploadError) {
            alert('Media upload failed: ' + uploadError.message);
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

    if (error) alert(error.message);
    else {
        document.getElementById('post-text').value = '';
        fileInput.value = '';
        loadFeed();
    }
}

// Load Social Timeline Feed
async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    const { data: posts, error } = await supabase
        .from('posts')
        .select(`*, profiles(username)`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    feed.innerHTML = '';
    posts.forEach(post => {
        let mediaHtml = '';
        if (post.media_url) {
            if (post.media_type === 'image') mediaHtml = `<img src="${post.media_url}" style="max-width:100%; border-radius:12px; margin-top:10px;">`;
            else if (post.media_type === 'video') mediaHtml = `<video controls src="${post.media_url}" style="max-width:100%; border-radius:12px; margin-top:10px;"></video>`;
            else if (post.media_type === 'audio') mediaHtml = `<audio controls src="${post.media_url}" style="width:100%; margin-top:10px;"></audio>`;
            else mediaHtml = `<a href="${post.media_url}" target="_blank" style="display:block; margin-top:10px; color:#1d9bf0;">📄 Download Attached Document</a>`;
        }

        feed.innerHTML += `
            <div class="post">
                <div class="post-header">@${post.profiles ? post.profiles.username : 'Anonymous'}</div>
                <div class="post-content">${post.content || ''}</div>
                ${mediaHtml}
                <div class="actions">
                    <span>❤️ ${post.likes_count || 0} Likes</span>
                </div>
            </div>
        `;
    });
}

// Initialization triggers
checkUserSession();
loadFeed();
