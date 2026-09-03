// Vercel Serverless Function: CloudSwarm Live State Endpoint (/state)

let cachedState = {
  nodes: {},
  edges: {},
  version: 0,
  selectedNodeId: null,
  inspectedNodeId: null
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    if (req.body) {
      cachedState = req.body;
    }
    return res.status(200).json({ status: 'STATE_RECEIVED', version: cachedState.version || 0 });
  }

  return res.status(200).json(cachedState);
}
