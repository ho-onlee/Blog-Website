const test = require('node:test');
const assert = require('node:assert/strict');
const { firstImageUrl } = require('../post-images');

test('firstImageUrl returns the first Markdown image and ignores fenced code', () => {
	assert.equal(firstImageUrl('```md\n![example](ignored.png)\n```\n![cover](first.png)\n![later](second.png)'), 'first.png');
});

test('firstImageUrl supports HTML images and Markdown angle-bracket URLs', () => {
	assert.equal(firstImageUrl('<img alt="first" src="first.png">\n![later](<second.png>)'), 'first.png');
	assert.equal(firstImageUrl('![first](<first.png>)'), 'first.png');
});

test('firstImageUrl returns an empty string when the content has no images', () => {
	assert.equal(firstImageUrl('Just text and a [regular link](page.html).'), '');
});