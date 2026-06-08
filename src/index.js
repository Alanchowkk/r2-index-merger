addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const urlObj = new URL(request.url);
  const path = urlObj.pathname;
  const origin = urlObj.origin;

  const tokenHeader = 'Bearer ' + (typeof HF_TOKEN_SECRET !== 'undefined' ? HF_TOKEN_SECRET : '');
  const PRIVATE_REPO_BASE = 'https://huggingface.co/datasets/zbw92017/english-listening-private/resolve/main';
  const PUBLIC_REPO_BASE = 'https://hf-mirror.com/datasets/zbw92017/english-listening/resolve/main';
  const OFFICIAL_BASE = 'https://dictaplus.teacheralan.dpdns.org';

  // 1. Handle proxy requests for private LRC files
  if (path.startsWith('/lrc/')) {
    try {
      const targetLrcUrl = `${PRIVATE_REPO_BASE}${path}`;
      const response = await fetch(targetLrcUrl, {
        headers: {
          'Authorization': tokenHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DictaPlus-Merger/1.0'
        }
      });
      
      if (!response.ok) {
        return new Response('Failed to fetch private LRC', { status: response.status });
      }
      
      const body = await response.text();
      return new Response(body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (e) {
      return new Response('Error fetching private LRC: ' + e.message, { status: 500 });
    }
  }

  // 2. Handle standard index merging
  const officialUrl = `${OFFICIAL_BASE}/index.json`;
  const privateIndexUrl = `${PRIVATE_REPO_BASE}/index.json`;
  
  let mergedAlbums = [];
  let mergedCategories = [];
  
  // Fetch official index
  try {
    const response = await fetch(officialUrl);
    if (response.ok) {
      const data = await response.json();
      // Prepend official base domain to relative official keys
      const albums = (data.albums || []).map(album => {
        if (album.coverUrl && !album.coverUrl.startsWith('http')) {
          album.coverUrl = `${OFFICIAL_BASE}/${album.coverUrl}`;
        }
        album.items = (album.items || []).map(item => {
          if (item.audioKey && !item.audioKey.startsWith('http')) {
            item.audioKey = `${OFFICIAL_BASE}/${item.audioKey}`;
          }
          if (item.lrcKey && !item.lrcKey.startsWith('http')) {
            item.lrcKey = `${OFFICIAL_BASE}/${item.lrcKey}`;
          }
          if (item.lrcEnKey && !item.lrcEnKey.startsWith('http')) {
            item.lrcEnKey = `${OFFICIAL_BASE}/${item.lrcEnKey}`;
          }
          return item;
        });
        return album;
      });
      mergedAlbums.push(...albums);
      
      if (data.categories) {
        data.categories.forEach(cat => {
          if (!mergedCategories.some(c => c.id === cat.id)) {
            mergedCategories.push(cat);
          }
        });
      }
    }
  } catch (e) {
    console.error("Error fetching official index:", e);
  }

  // Fetch private index from Hugging Face
  try {
    const response = await fetch(privateIndexUrl, {
      headers: {
        'Authorization': tokenHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DictaPlus-Merger/1.0'
      }
    });
    if (response.ok) {
      const data = await response.json();
      
      const albums = (data.albums || []).map(album => {
        // Resolve covers to official domain if relative
        if (album.coverUrl && !album.coverUrl.startsWith('http')) {
          album.coverUrl = `${OFFICIAL_BASE}/${album.coverUrl}`;
        }
        album.items = (album.items || []).map(item => {
          // audioKey is in public repo
          if (item.audioKey && !item.audioKey.startsWith('http')) {
            item.audioKey = `${PUBLIC_REPO_BASE}/${item.audioKey}`;
          }
          // lrcEnKey (English LRC) is in public repo
          if (item.lrcEnKey && !item.lrcEnKey.startsWith('http')) {
            item.lrcEnKey = `${PUBLIC_REPO_BASE}/${item.lrcEnKey}`;
          }
          // lrcKey (Bilingual LRC) is private, route through Worker
          if (item.lrcKey && !item.lrcKey.startsWith('http')) {
            item.lrcKey = `${origin}/${item.lrcKey}`;
          }
          return item;
        });
        return album;
      });
      
      mergedAlbums.push(...albums);
      
      if (data.categories) {
        data.categories.forEach(cat => {
          if (!mergedCategories.some(c => c.id === cat.id)) {
            mergedCategories.push(cat);
          }
        });
      }
    }
  } catch (e) {
    console.error("Error fetching private index:", e);
  }
  
  // Return the unified feed
  return new Response(JSON.stringify({
    schemaVersion: 3,
    categories: mergedCategories,
    albums: mergedAlbums
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=60'
    }
  });
}
