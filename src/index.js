addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // 1. Configure the multiple R2 public index.json URLs to merge
  const sourceUrls = [
    "https://dictaplus.teacheralan.dpdns.org/index.json" // Official demo bucket
  ]
  
  let mergedAlbums = []
  let mergedCategories = []
  
  for (let url of sourceUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DictaPlus-Merger/1.0'
        }
      })
      if (response.ok) {
        const data = await response.json()
        
        // Extract the base domain path from the URL
        const lastSlash = url.lastIndexOf('/')
        const base = lastSlash !== -1 ? url.substring(0, lastSlash) : url
        
        // Convert any relative URLs inside this feed to absolute URLs using the source Base URL
        const albums = (data.albums || []).map(album => {
          if (album.coverUrl && !album.coverUrl.startsWith('http')) {
            album.coverUrl = `${base}/${album.coverUrl}`
          }
          album.items = (album.items || []).map(item => {
            if (item.audioKey && !item.audioKey.startsWith('http')) {
              item.audioKey = `${base}/${item.audioKey}`
            }
            if (item.lrcKey && !item.lrcKey.startsWith('http')) {
              item.lrcKey = `${base}/${item.lrcKey}`
            }
            if (item.lrcEnKey && !item.lrcEnKey.startsWith('http')) {
              item.lrcEnKey = `${base}/${item.lrcEnKey}`
            }
            return item
          })
          return album
        })
        
        mergedAlbums.push(...albums)
        
        // Merge categories uniquely
        if (data.categories) {
          data.categories.forEach(cat => {
            if (!mergedCategories.some(c => c.id === cat.id)) {
              mergedCategories.push(cat)
            }
          })
        }
      }
    } catch (e) {
      console.error(`Error fetching or parsing index from ${url}:`, e)
    }
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
  })
}
