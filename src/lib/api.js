const BASE = '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('admin_token')
  const headers = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(BASE + path, {
    ...options,
    headers: { ...headers, ...options.headers },
  })
  
  if (res.status === 401) {
    throw new Error("Unauthorized: Invalid or missing Admin Password")
  }

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

export const fetchFormulations = () => request('/formulations')

export const insertFormulation = (payload) =>
  request('/formulations', { method: 'POST', body: JSON.stringify(payload) })

export const updateFormulation = (id, payload) =>
  request(`/formulations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const deleteFormulation = (id) =>
  request(`/formulations/${id}`, { method: 'DELETE' })

export const semanticSearch = (query, limit = 20, signal) =>
  request('/semantic-search', { method: 'POST', body: JSON.stringify({ query, limit }), signal })

export const searchFormulations = (query, category, limit = 20, signal) =>
  request('/search', { method: 'POST', body: JSON.stringify({ query, category, limit }), signal })
