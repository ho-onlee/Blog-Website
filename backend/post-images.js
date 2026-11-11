function firstImageUrl(content) {
	const text = String(content || '').replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
	const imagePattern = /!\[[^\]]*\]\(\s*(?:<([^>\s]+)>|([^\s)]+))[^)]*\)|<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;
	const match = imagePattern.exec(text);
	return match ? match.slice(1).find(Boolean) || '' : '';
}

module.exports = { firstImageUrl };