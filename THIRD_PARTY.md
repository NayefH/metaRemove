# Third-party software

This application serves its dependencies locally. No third-party CDN is used at runtime.

| Component | License | Source |
| --- | --- | --- |
| React / React DOM | MIT | https://github.com/facebook/react |
| Vite | MIT | https://github.com/vitejs/vite |
| lucide-react | ISC | https://github.com/lucide-icons/lucide |
| exifr | MIT | https://github.com/MikeKovarik/exifr |
| fflate | MIT | https://github.com/101arrowz/fflate |
| @ffmpeg/ffmpeg | MIT | https://github.com/ffmpegwasm/ffmpeg.wasm |
| @ffmpeg/core 0.12.10, including its compiled codec dependencies | GPL-2.0-or-later | https://github.com/ffmpegwasm/ffmpeg.wasm/tree/core%400.12.10 |

Exact dependency versions and package integrity hashes are recorded in `package-lock.json`. FFmpeg.wasm's corresponding source and build scripts (including codec dependency versions) are available in its linked release source. The FFmpeg core is provided as a separate WebAssembly program and JavaScript loader in `ffmpeg/` in the published site. FFmpeg: https://ffmpeg.org/ . GPL text: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html .
