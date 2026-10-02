const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const validRoomId = value => typeof value === 'string' && /^[1-9]\d{15,21}$/.test(value);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const username = req.query.username;
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_.]{1,24}$/.test(username)) {
    return res.status(400).json({ error: 'INVALID_USERNAME' });
  }
  const sources = [];
  const urls = [
    ['html', `https://www.tiktok.com/@${encodeURIComponent(username)}/live`],
    ['api', `https://www.tiktok.com/api-live/user/room/?aid=1988&uniqueId=${encodeURIComponent(username)}&sourceType=54`]
  ];
  for (const [source, url] of urls) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': userAgent, 'Accept-Language': 'en-US,en;q=0.9' },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) { sources.push({ source, status: response.status }); continue; }
      const body = await response.text();
      const data = source === 'api' ? JSON.parse(body) : JSON.parse(body.match(/<script\b[^>]*\bid=["']SIGI_STATE["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || '{}');
      const user = source === 'api' ? data?.data?.user : data?.LiveRoom?.liveRoomUserInfo?.user;
      if (validRoomId(user?.roomId)) return res.status(200).json({ username, roomId: user.roomId });
      sources.push({ source, status: response.status, reason: body ? 'ROOM_ID_MISSING' : 'EMPTY_RESPONSE' });
    } catch (error) {
      sources.push({ source, reason: error?.name === 'TimeoutError' ? 'TIMEOUT' : 'INVALID_RESPONSE' });
    }
  }
  return res.status(502).json({ error: 'ROOM_LOOKUP_FAILED', sources });
}
