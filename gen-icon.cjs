const sharp = require("sharp");
const size = 1024;
const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="200" fill="#1db954"/>
  <text x="50%" y="55%" font-family="Arial,sans-serif" font-size="600" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">V</text>
</svg>`;
sharp(Buffer.from(svg)).png().toFile("app-icon.png").then(() => console.log("Icon created"));
