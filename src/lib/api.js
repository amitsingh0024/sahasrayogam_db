const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
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
