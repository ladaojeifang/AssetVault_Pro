function isC4DHeader(buf) {
  return buf.slice(0, 8).toString('ascii') === 'QC4DC4D6';
}

function isOle(buf) {
  const ole = Buffer.from([0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1]);
  return buf.length >= 8 && buf.subarray(0,8).equals(ole);
}

function isGzip(buf) {
  return buf.length >= 3 && buf[0] === 0x1f && buf[1] === 0x8b && buf[2] === 0x08;
}

function isBlendHeader(buf) {
  return buf.length >= 7 && buf.slice(0, 7).toString('ascii') === 'BLENDER';
}

function isHipHeader(buf) {
  const s = buf.slice(0, 6).toString('ascii');
  return s === '070707';
}

module.exports = { isC4DHeader, isOle, isGzip, isBlendHeader, isHipHeader };