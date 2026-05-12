// Standalone page that mocks a side-by-side split view of two search engines.
// Real Google/Bing block themselves from being iframed (X-Frame-Options /
// frame-ancestors), so we render plausible simulated result pages via srcdoc.

const params = new URLSearchParams(location.search);
const query = params.get("q") || "";
const leftId = params.get("left") || "google";
const rightId = params.get("right") || "bing";
const domain = params.get("domain") || "";

document.title = "Split view: " + (query || "search");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Full brand wordmarks/logos sourced from Wikimedia Commons (Google 2015 logo,
// Bing Fluent Logo Text, DuckDuckGo wordmark, Amazon logo, Perplexity AI logo).
// Wikipedia's puzzle-globe SVG is far too heavy to inline, so it's rendered as
// a styled wordmark instead.
const LOGOS = {
  google: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 272 92"><path fill="#EA4335" d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/><path fill="#FBBC05" d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/><path fill="#4285F4" d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"/><path fill="#34A853" d="M225 3v65h-9.5V3h9.5z"/><path fill="#EA4335" d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"/><path fill="#4285F4" d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z"/></svg>`,

  bing: `<svg viewBox="0 0 2535 1024" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M342.444 322.924C323.57 325.117 309.176 340.445 307.838 359.775C307.261 368.104 307.442 368.669 326.321 417.25C369.273 527.78 379.679 554.382 381.429 558.126C385.669 567.193 391.631 575.723 399.08 583.379C404.796 589.254 408.566 592.413 414.942 596.672C426.148 604.156 431.709 606.225 475.314 619.136C517.79 631.713 540.996 640.072 560.993 649.997C586.899 662.855 604.974 677.481 616.407 694.835C624.61 707.287 631.875 729.616 635.036 752.093C636.272 760.879 636.28 780.301 635.051 788.244C632.384 805.483 627.057 819.929 618.908 832.018C614.574 838.447 616.082 837.371 622.383 829.536C640.215 807.365 658.38 769.472 667.649 735.11C678.866 693.523 680.392 648.866 672.04 606.599C655.775 524.29 603.814 453.257 530.632 413.289C526.034 410.777 508.52 401.597 484.776 389.252C481.173 387.378 476.26 384.813 473.858 383.552C471.456 382.29 466.543 379.725 462.94 377.852C459.337 375.979 448.965 370.575 439.891 365.844C430.817 361.112 420.664 355.818 417.328 354.079C407.159 348.777 400.336 345.215 395.249 342.552C371.721 330.235 361.762 325.256 358.923 324.392C355.945 323.486 348.38 322.323 346.482 322.479C346.082 322.512 344.265 322.712 342.444 322.924Z" fill="url(#bp0)"/><path d="M393.737 735.544C392.433 736.316 390.603 737.434 389.669 738.027C388.734 738.621 386.66 739.91 385.059 740.893C379.182 744.5 363.552 754.131 350.121 762.422C341.294 767.871 339.984 768.683 328.771 775.642C324.767 778.126 320.509 780.744 319.308 781.46C318.107 782.176 312.976 785.336 307.905 788.482C302.834 791.627 293.991 797.087 288.253 800.614C282.515 804.14 272.252 810.471 265.447 814.682C258.641 818.892 249.688 824.413 245.552 826.95C241.415 829.486 237.594 831.936 237.06 832.394C236.267 833.074 199.475 855.865 181.014 867.112C166.993 875.653 150.773 881.366 134.169 883.61C126.439 884.654 111.811 884.658 104.103 883.616C83.2021 880.794 63.9476 872.999 47.4576 860.687C40.9893 855.857 28.8117 843.689 24.1563 837.403C13.1855 822.592 6.08829 806.705 2.41258 788.729C1.56681 784.592 0.766658 781.099 0.635158 780.965C0.291606 780.618 0.912197 786.867 2.03165 795.037C3.19575 803.534 5.67635 815.824 8.3481 826.335C29.0233 907.68 87.8556 973.842 167.5 1005.32C190.434 1014.38 213.577 1020.09 238.758 1022.89C248.22 1023.95 275.003 1024.37 284.878 1023.62C330.165 1020.19 369.597 1006.86 410.049 981.295C413.652 979.018 420.421 974.75 425.091 971.809C429.762 968.869 435.657 965.131 438.193 963.504C440.728 961.876 443.785 959.953 444.986 959.231C446.187 958.508 448.589 956.999 450.324 955.876C452.059 954.754 459.483 950.058 466.822 945.441L496.17 926.904L506.247 920.539L506.61 920.31L507.72 919.609L508.248 919.275L515.667 914.589L541.307 898.394C573.977 877.865 583.719 870.658 598.897 855.79C605.225 849.593 614.765 839.013 615.239 837.67C615.335 837.397 617.031 834.781 619.007 831.857C627.039 819.972 632.395 805.413 635.051 788.244C636.28 780.301 636.272 760.879 635.036 752.093C632.647 735.106 627.219 715.838 621.367 703.569C611.77 683.451 591.326 665.171 561.957 650.449C553.848 646.384 545.474 642.664 544.539 642.713C544.096 642.736 516.766 659.441 483.806 679.837C450.846 700.233 422.24 717.936 420.239 719.178C418.237 720.421 414.798 722.522 412.596 723.846L393.737 735.544Z" fill="url(#bp1)"/><path d="M0.141154 637.697L0.282367 779.752L2.12098 788.001C7.87013 813.792 17.8312 832.387 35.148 849.658C43.2933 857.782 49.5219 862.68 58.3485 867.903C77.0259 878.956 97.1276 884.409 119.146 884.399C142.207 884.387 162.156 878.635 182.713 866.07C186.182 863.95 199.775 855.581 212.919 847.472L236.817 832.729V664.186V495.643L236.81 341.457C236.805 243.089 236.625 184.67 236.314 180.087C234.354 151.286 222.309 124.809 202.055 104.782C195.839 98.6357 190.528 94.5305 174.706 83.6427C166.833 78.2244 152.421 68.2988 142.68 61.586C132.939 54.8727 116.89 43.8135 107.015 37.0094C97.1402 30.2058 83.056 20.4986 75.7167 15.4385C60.4272 4.89657 59.2306 4.16335 54.6087 2.50964C48.597 0.359048 42.2263 -0.430914 36.1695 0.223193C18.5163 2.12971 4.38462 14.8756 0.711338 32.2041C0.139722 34.9001 0.0344077 70.7794 0.027129 265.516L0.0188956 495.643H0L0.141154 637.697Z" fill="url(#bp2)"/><path d="M993 811.415V209.867H1184.03C1242.19 209.867 1288.47 222.603 1322.43 248.074C1356.39 273.546 1373.37 306.658 1373.37 347.413C1373.37 381.374 1363.61 411.091 1344.5 436.562C1324.07 462.407 1295.99 481.129 1264.27 490.052V491.75C1305.87 496.42 1338.56 511.702 1363.18 538.023C1388.23 563.494 1400.54 597.456 1400.54 638.634C1400.54 690.002 1380.16 732.029 1339.83 763.444C1299.5 794.858 1248.14 811.415 1186.16 811.415H993ZM1092.76 290.102V461.184H1157.29C1192.1 461.184 1219.27 452.694 1238.8 436.987C1258.75 420.006 1268.51 397.082 1268.51 367.365C1268.51 315.573 1234.13 290.102 1165.36 290.102H1092.76ZM1092.76 541.419V731.605H1177.67C1215.02 731.605 1243.89 723.114 1263.84 706.133C1284.22 688.728 1294.41 664.955 1294.41 634.814C1294.41 572.409 1251.53 541.419 1164.93 541.419H1092.76ZM1522.38 291.8C1506.67 291.8 1492.66 286.281 1481.62 276.093C1470.16 265.904 1464.64 252.744 1464.64 236.612C1464.64 220.481 1470.16 207.32 1481.62 196.707C1493.09 186.094 1506.67 181 1522.8 181C1538.93 181 1552.94 186.094 1564.41 196.707C1575.87 207.32 1581.39 220.905 1581.39 236.612C1581.39 251.895 1575.87 264.631 1564.41 275.668C1552.94 286.281 1538.93 291.8 1522.38 291.8ZM1570.77 811.415H1473.56V381.799H1571.2L1570.77 811.415ZM2052.61 811.415H1955.39V569.437C1955.39 488.778 1926.95 448.873 1870.49 448.873C1840.77 448.873 1816.15 460.335 1796.62 482.835C1776.97 506.172 1766.68 535.975 1767.75 566.466V811.415H1670.11V381.799H1767.75V453.118H1769.45C1782.75 427.896 1802.83 406.896 1827.44 392.492C1852.05 378.088 1880.19 370.855 1908.69 371.61C1955.39 371.61 1991.05 386.893 2015.67 417.459C2040.29 447.6 2052.61 491.325 2052.61 549.06V811.415ZM2534.44 777.029C2534.44 934.526 2455.48 1013.49 2296.71 1013.49C2246.45 1014.64 2196.53 1005.09 2150.25 985.469V896.319C2196.94 923.488 2241.94 936.649 2283.97 936.649C2385.86 936.649 2437.22 886.555 2437.22 785.943V739.246H2435.52C2421.41 765.119 2400.33 786.513 2374.66 800.997C2349 815.481 2319.78 822.473 2290.34 821.179C2266.31 821.95 2242.43 817.227 2220.5 807.369C2198.58 797.51 2179.2 782.778 2163.83 764.293C2130 720.278 2112.99 665.633 2115.86 610.191C2115.86 537.174 2132.84 479.439 2167.65 436.138C2202.46 392.836 2249.16 371.61 2309.44 371.61C2365.9 371.61 2407.93 394.959 2435.52 441.232H2437.22V381.799H2534.86L2534.44 777.029ZM2438.07 614.861V558.824C2438.07 528.683 2427.88 502.787 2407.93 481.561C2398.53 471.126 2386.99 462.842 2374.09 457.274C2361.2 451.706 2347.26 448.985 2333.22 449.298C2296.28 449.298 2267.41 463.307 2246.61 490.476C2223.86 524.047 2212.82 564.187 2215.2 604.673C2215.2 647.125 2225.39 680.662 2244.91 706.133C2265.29 731.605 2291.61 743.916 2324.72 743.916C2358.69 743.916 2385.86 731.605 2406.66 707.831C2427.88 683.209 2438.07 652.644 2438.07 614.437V614.861Z" fill="#737373"/><defs><radialGradient id="bp0" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(654.126 722.251) rotate(-130.909) scale(529.064 380.685)"><stop stop-color="#00CACC"/><stop offset="1" stop-color="#048FCE"/></radialGradient><radialGradient id="bp1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(88.8183 915.135) rotate(-23.1954) scale(572.26 953.69)"><stop stop-color="#00BBEC"/><stop offset="1" stop-color="#2756A9"/></radialGradient><linearGradient id="bp2" x1="118.409" y1="0" x2="118.409" y2="884.399" gradientUnits="userSpaceOnUse"><stop stop-color="#00BBEC"/><stop offset="1" stop-color="#2756A9"/></linearGradient></defs></svg>`,

  ddg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 120 60"><g transform="translate(0 .068)"><path fill="#4c4c4c" d="M17.7 53.08V42.92h3.68c3.505 0 5.1 2.574 5.1 4.968 0 2.583-1.577 5.187-5.1 5.187zm1.17-1.17h2.51c2.715 0 3.93-2.025 3.93-4.033 0-1.845-1.23-3.828-3.93-3.828h-2.51zm12.247 1.287c-1.88 0-3.096-1.295-3.096-3.3v-3.944h1.097v3.93c0 1.444.84 2.306 2.247 2.306 1.32-.014 2.277-1.027 2.277-2.408v-3.827h1.097v7.127h-.997l-.063-1.24-.17.214c-.59.743-1.396 1.128-2.393 1.143zm8.973.015c-1.858 0-3.725-1.144-3.725-3.696 0-2.21 1.497-3.695 3.725-3.695a3.57 3.57 0 0 1 2.547 1.033l-.7.715c-.485-.453-1.148-.7-1.828-.7-1.556 0-2.643 1.093-2.643 2.657 0 1.836 1.32 2.66 2.628 2.66.736 0 1.404-.263 1.888-.743l.717.717c-.72.703-1.602 1.06-2.62 1.06zm10.02-.132h-1.392l-3.483-3.483v3.483h-1.083V42.93h1.083v6.135l3.045-3.12h1.42l-3.36 3.36 3.77 3.758zm1.35 0V42.92h3.68c3.505 0 5.102 2.574 5.102 4.968 0 2.583-1.575 5.187-5.102 5.187zm1.17-1.17h2.51c2.715 0 3.93-2.025 3.93-4.033 0-1.845-1.23-3.828-3.93-3.828h-2.51zm12.247 1.287c-1.88 0-3.095-1.295-3.095-3.3v-3.944h1.097v3.93c0 1.444.84 2.306 2.246 2.306 1.32-.014 2.277-1.027 2.277-2.408v-3.827h1.097v7.127H67.5l-.062-1.24-.17.214c-.59.743-1.396 1.128-2.392 1.143zm8.975.015c-1.858 0-3.725-1.144-3.725-3.696 0-2.21 1.497-3.695 3.725-3.695a3.57 3.57 0 0 1 2.547 1.033l-.7.715c-.486-.453-1.148-.7-1.83-.7-1.557 0-2.642 1.093-2.642 2.657 0 1.836 1.32 2.66 2.628 2.66.735 0 1.404-.263 1.888-.743l.696.697-.036.04.02.02c-.714.677-1.582 1.022-2.583 1.022zm10.02-.132h-1.4l-3.484-3.482v3.483h-1.082V42.936h1.082v6.135l3.045-3.12h1.42L80.1 49.3l3.768 3.758zm5.747.19c-3.905 0-5.29-2.787-5.29-5.174-.008-1.555.52-2.942 1.48-3.91.947-.952 2.26-1.455 3.796-1.455 1.377-.005 2.702.53 3.69 1.488l-.662.772a4.6 4.6 0 0 0-3.027-1.178c-2.83 0-4.12 2.22-4.12 4.28 0 2.027 1.282 4.077 4.15 4.077 1.044 0 2.018-.357 2.813-1.04l.04-.03v-2.503h-3.192v-1.024h4.243v3.983c-1.096 1.156-2.373 1.71-3.923 1.71zm8.975-.06c-2.142 0-3.696-1.548-3.696-3.68 0-2.166 1.557-3.74 3.696-3.74 2.19 0 3.71 1.537 3.71 3.74 0 2.133-1.56 3.68-3.71 3.68zm.014-6.425c-1.54 0-2.612 1.13-2.612 2.744 0 1.54 1.093 2.658 2.6 2.658 1.528 0 2.612-1.093 2.626-2.657 0-1.59-1.098-2.745-2.613-2.745z"/><g transform="matrix(.260934 0 0 .260934 26.775065 1.647222)"><circle r="51.15" cy="78.966" cx="127.332" fill="#de5833"/><path fill="#d5d7d8" d="M148.293 155.158c-1.8-8.285-12.262-27.04-16.23-34.97s-7.938-19.1-6.13-26.322c.328-1.312-3.436-11.308-2.354-12.015 8.416-5.5 10.632.6 14.002-1.862 1.734-1.273 4.1 1.047 4.7-1.06 2.158-7.567-3.006-20.76-8.77-26.526-1.885-1.88-4.77-3.06-8.03-3.687-1.254-1.713-3.275-3.36-6.138-4.88-3.188-1.697-10.12-3.938-13.717-4.535-2.492-.4-3.055.287-4.12.46.992.088 5.7 2.414 6.615 2.55-.916.62-3.607-.028-5.324.742-.865.392-1.512 1.877-1.506 2.58 4.9-.496 12.574-.016 17.1 2-3.602.4-9.08.867-11.436 2.105-6.848 3.608-9.873 12.035-8.07 22.133 1.804 10.075 9.738 46.85 12.262 59.13 2.525 12.264-5.408 20.2-10.455 22.354l5.408.363-1.8 3.967c6.484.72 13.695-1.44 13.695-1.44-1.438 3.965-11.176 5.412-11.176 5.412s4.7 1.438 12.258-1.447l12.263-4.688 3.604 9.373 6.854-6.847 2.885 7.2c.014-.001 5.424-1.808 3.62-10.103z"/><path fill="#fff" d="M150.47 153.477c-1.795-8.3-12.256-27.043-16.228-34.98s-7.935-19.112-6.13-26.32c.335-1.3.34-6.668 1.43-7.38 8.4-5.494 7.812-.184 11.187-2.645 1.74-1.27 3.133-2.806 3.738-4.912 2.164-7.572-3.006-20.76-8.773-26.53-1.88-1.88-4.768-3.062-8.023-3.686-1.252-1.718-3.27-3.36-6.13-4.882-5.4-2.862-12.074-4.006-18.266-2.883 1 .1 3.256 2.138 4.168 2.273-1.38.936-5.053.815-5.03 2.896 4.916-.492 10.303.285 14.834 2.297-3.602.4-6.955 1.3-9.3 2.543-6.854 3.603-8.656 10.812-6.854 20.914 1.807 10.097 9.742 46.873 12.256 59.126 2.527 12.26-5.402 20.188-10.45 22.354l5.408.36-1.8 3.973c6.484.72 13.695-1.44 13.695-1.44-1.438 3.974-11.176 5.406-11.176 5.406s4.686 1.44 12.258-1.445l12.27-4.688 3.604 9.373 6.852-6.85 2.9 7.215c-.016.007 5.388-1.797 3.58-10.088z"/><path fill="#2d4f8e" d="M109.02 70.69c0-2.093 1.693-3.787 3.79-3.787 2.1 0 3.785 1.694 3.785 3.787s-1.695 3.786-3.785 3.786c-2.096.001-3.79-1.692-3.79-3.786z"/><path fill="#fff" d="M113.507 69.43a.98.98 0 0 1 .98-.983c.543 0 .984.438.984.983s-.44.984-.984.984c-.538.001-.98-.44-.98-.984z"/><path fill="#2d4f8e" d="M134.867 68.445c0-1.793 1.46-3.25 3.252-3.25 1.8 0 3.256 1.457 3.256 3.25 0 1.8-1.455 3.258-3.256 3.258a3.26 3.26 0 0 1-3.252-3.258z"/><path fill="#fff" d="M138.725 67.363c0-.463.38-.843.838-.843a.84.84 0 0 1 .846.843c0 .47-.367.842-.846.842a.84.84 0 0 1-.838-.842z"/><path fill="#fdd20a" d="M124.4 85.295c.38-2.3 6.3-6.625 10.5-6.887 4.2-.265 5.5-.205 9-1.043s12.535-3.088 15.033-4.242c2.504-1.156 13.104.572 5.63 4.738-3.232 1.8-11.943 5.13-18.172 6.987-6.22 1.86-10-1.776-12.06 1.28-1.646 2.432-.334 5.762 7.1 6.453 10.037.93 19.66-4.52 20.72-1.625s-8.625 6.508-14.525 6.623c-5.893.1-17.77-3.896-19.555-5.137s-4.165-4.13-3.67-7.148z"/><path fill="#65bc46" d="M128.943 115.592s-14.102-7.52-14.332-4.47c-.238 3.056 0 15.5 1.643 16.45s13.396-6.108 13.396-6.108zm5.403-.474s9.635-7.285 11.754-6.815c2.1.48 2.582 15.5.7 16.23-1.88.7-12.908-3.813-12.908-3.813z"/><path fill="#43a244" d="M125.53 116.4c0 4.932-.7 7.05 1.4 7.52s6.104 0 7.518-.938.232-7.28-.232-8.465c-.477-1.174-8.696-.232-8.696 1.884z"/><path fill="#65bc46" d="M126.426 115.292c0 4.933-.707 7.05 1.4 7.52 2.106.48 6.104 0 7.52-.938 1.4-.94.23-7.28-.236-8.466-.473-1.173-8.692-.227-8.692 1.885z"/></g></g></svg>`,

  amazon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60" fill-rule="evenodd"><path d="M72.038 40.703c-5.8 4.283-14.234 6.57-21.486 6.57-10.168 0-19.323-3.76-26.248-10.016-.544-.492-.057-1.162.596-.78 7.474 4.35 16.715 6.965 26.26 6.965 6.438 0 13.52-1.332 20.032-4.096.984-.418 1.806.644.844 1.358m2.418-2.764c-.74-.95-4.9-.448-6.782-.226-.57.07-.657-.427-.144-.784 3.32-2.338 8.77-1.663 9.407-.88s-.165 6.25-3.286 8.858c-.48.4-.936.187-.723-.344.7-1.75 2.272-5.672 1.528-6.625" fill="#f90"/><path d="M67.803 20.427v-2.272a.56.56 0 0 1 .575-.575H78.55c.326 0 .588.235.588.575V20.1c-.004.326-.28.753-.766 1.428l-5.27 7.526c1.96-.048 4.026.244 5.802 1.245.4.226.5.557.54.884v2.425c0 .33-.366.718-.75.518-3.13-1.64-7.287-1.82-10.747.017-.353.192-.723-.192-.723-.522v-2.303c0-.37.004-1 .374-1.563l6.107-8.758H68.4c-.326 0-.588-.23-.588-.57M30.694 34.605H27.6c-.296-.022-.53-.244-.553-.527V18.194c0-.318.266-.57.596-.57h2.886c.3.013.54.244.562.53v2.076h.057c.753-2.007 2.168-2.943 4.074-2.943 1.937 0 3.147.936 4.018 2.943.75-2.007 2.45-2.943 4.275-2.943 1.297 0 2.716.535 3.582 1.737.98 1.336.78 3.278.78 4.98L47.87 34.03c0 .318-.266.575-.596.575h-3.1c-.3-.022-.557-.27-.557-.575V25.6c0-.67.06-2.342-.087-2.977-.23-1.066-.923-1.367-1.82-1.367-.75 0-1.532.5-1.85 1.302s-.287 2.142-.287 3.043v8.42c0 .318-.266.575-.596.575h-3.1c-.313-.022-.557-.27-.557-.575l-.004-8.42c0-1.772.292-4.38-1.907-4.38-2.224 0-2.137 2.542-2.137 4.38v8.42c0 .318-.266.575-.596.575M87.896 17.3c4.592 0 7.078 3.944 7.078 8.958 0 4.845-2.747 8.688-7.078 8.688-4.5 0-6.965-3.944-6.965-8.858 0-4.945 2.486-8.8 6.965-8.8m.026 3.243c-2.28 0-2.425 3.108-2.425 5.045s-.03 6.085 2.398 6.085c2.398 0 2.512-3.343 2.512-5.38 0-1.34-.057-2.943-.46-4.214-.348-1.106-1.04-1.537-2.024-1.537m13.007 14.075h-3.082c-.3-.022-.557-.27-.557-.575l-.004-15.888c.026-.292.283-.518.596-.518h2.87c.27.013.492.196.553.444v2.43h.057c.866-2.172 2.08-3.208 4.218-3.208 1.4 0 2.742.5 3.613 1.872.8 1.27.8 3.408.8 4.945v10c-.035.28-.292.5-.596.5H106.3c-.283-.022-.518-.23-.548-.5V25.48c0-1.737.2-4.28-1.937-4.28-.753 0-1.445.505-1.8 1.27-.435.97-.492 1.937-.492 3.008v8.554c-.004.318-.274.575-.605.575m-41.225-7.6c0 1.206.03 2.2-.58 3.282-.492.87-1.275 1.406-2.142 1.406-1.188 0-1.885-.905-1.885-2.242 0-2.638 2.364-3.117 4.605-3.117v.67m3.12 7.544c-.205.183-.5.196-.73.074-1.027-.853-1.214-1.25-1.776-2.063-1.698 1.732-2.903 2.25-5.102 2.25-2.607 0-4.632-1.606-4.632-4.823 0-2.512 1.358-4.222 3.3-5.058 1.68-.74 4.026-.87 5.82-1.075v-.4c0-.736.057-1.606-.38-2.242-.374-.57-1.097-.805-1.737-.805-1.18 0-2.23.605-2.486 1.86-.052.28-.257.553-.54.566l-3-.322c-.252-.057-.535-.26-.46-.65.688-3.64 3.98-4.736 6.92-4.736 1.506 0 3.474.4 4.662 1.54 1.506 1.406 1.362 3.282 1.362 5.324v4.823c0 1.45.6 2.085 1.167 2.87.196.28.24.614-.013.823L62.82 34.57l-.004-.01M19.12 27.017c0 1.206.03 2.2-.58 3.282-.492.87-1.27 1.406-2.142 1.406-1.188 0-1.88-.905-1.88-2.242 0-2.638 2.364-3.117 4.6-3.117v.67m3.12 7.544c-.205.183-.5.196-.73.074-1.027-.853-1.2-1.25-1.776-2.063-1.698 1.732-2.9 2.25-5.102 2.25C12.028 34.822 10 33.216 10 30c0-2.512 1.362-4.222 3.3-5.058 1.68-.74 4.026-.87 5.82-1.075v-.4c0-.736.057-1.606-.374-2.242-.38-.57-1.1-.805-1.737-.805-1.18 0-2.233.605-2.5 1.86-.052.28-.257.553-.535.566l-3.004-.322c-.252-.057-.53-.26-.46-.65.692-3.64 3.98-4.736 6.92-4.736 1.506 0 3.474.4 4.662 1.54 1.506 1.406 1.362 3.282 1.362 5.324v4.823c0 1.45.6 2.085 1.167 2.87.2.28.244.614-.01.823l-2.36 2.052-.01-.01" fill="#221f1f"/></svg>`,

  perplexity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 149.82 36"><path fill="none" stroke="#20808d" stroke-miterlimit="10" d="m23.566,1.398l-9.495,9.504h9.495V1.398v2.602V1.398Zm-9.496,9.504L4.574,1.398v9.504h9.496Zm-.021-10.902v36m9.517-15.596l-9.495-9.504v13.625l9.495,9.504v-13.625Zm-18.991,0l9.496-9.504v13.625l-9.496,9.504v-13.625ZM.5,10.9v13.57h4.074v-4.066l9.496-9.504H.5Zm13.57,0l9.495,9.504v4.066h4.075v-13.57h-13.57Z"/><path fill="#13343b" d="m55.46,13.028c.593-1.109,1.422-1.963,2.491-2.564,1.067-.599,2.319-.899,3.755-.899s2.625.295,3.62.886c.996.591,1.741,1.374,2.234,2.349.493.976.74,2.045.74,3.207v1.61h-11.171c.09,1.396.561,2.506,1.413,3.329.852.824,1.996,1.235,3.433,1.235,1.166,0,2.06-.237,2.678-.711.62-.474,1.072-1.131,1.36-1.973h2.558c-.341,1.306-1.036,2.439-2.086,3.396-1.049.958-2.553,1.436-4.509,1.436-1.472,0-2.769-.3-3.891-.899-1.121-.599-1.988-1.454-2.598-2.564-.61-1.11-.915-2.416-.915-3.92s.296-2.809.889-3.919h-.001Zm10.149,2.576c0-1.217-.314-2.169-.942-2.859-.628-.689-1.615-1.033-2.962-1.033-1.256,0-2.284.335-3.082,1.006-.799.671-1.288,1.634-1.467,2.886h8.453Zm6.047-5.637v2.228c0,.126.063.188.189.188.072,0,.125-.018.162-.054.037-.036.072-.107.107-.214.466-1.467,1.624-2.201,3.473-2.201h1.184v2.415h-1.535c-1.203,0-2.1.286-2.693.859-.593.573-.889,1.512-.889,2.819v7.919h-2.423v-13.96h2.425Zm19.342,11.019c-.637,1.118-1.463,1.955-2.477,2.509-1.014.554-2.105.832-3.271.832-2.297,0-3.913-.912-4.846-2.738-.072-.142-.162-.214-.269-.214s-.162.054-.162.161v7.489h-2.423V9.968h2.423v2.389c0,.107.054.161.162.161s.197-.072.269-.214c.933-1.826,2.549-2.738,4.846-2.738,1.166,0,2.257.278,3.271.832,1.014.554,1.839,1.391,2.477,2.51.637,1.118.956,2.466.956,4.039s-.319,2.921-.956,4.04Zm-2.8-7.892c-.889-.922-2.06-1.383-3.513-1.383s-2.625.461-3.513,1.383c-.889.922-1.215,2.206-1.215,3.852s.326,2.931,1.215,3.852c.889.922,2.06,1.383,3.513,1.383s2.625-.46,3.513-1.383c.889-.922,1.333-2.206,1.333-3.852s-.444-2.93-1.333-3.852Zm7.272-8.496v19.327h-2.423V4.6h2.423Zm1.995,8.429c.592-1.109,1.422-1.963,2.491-2.564,1.067-.599,2.319-.899,3.754-.899s2.626.295,3.621.886c.996.591,1.741,1.374,2.234,2.349.494.976.74,2.045.74,3.207v1.61h-11.171c.09,1.396.561,2.506,1.413,3.329.852.824,1.996,1.235,3.433,1.235,1.166,0,2.059-.237,2.678-.711.62-.474,1.072-1.131,1.36-1.973h2.558c-.341,1.306-1.036,2.439-2.086,3.396-1.049.958-2.553,1.436-4.509,1.436-1.472,0-2.769-.3-3.891-.899-1.121-.599-1.988-1.454-2.598-2.564-.61-1.11-.915-2.416-.915-3.92s.296-2.809.889-3.919h-.002Zm10.149,2.576c0-1.217-.314-2.169-.942-2.859-.628-.689-1.615-1.033-2.962-1.033-1.256,0-2.284.335-3.082,1.006-.799.671-1.288,1.634-1.467,2.886h8.453Zm14.061-5.005l-3.554,5.708,4.061,6.483h-2.756l-2.685-4.366-2.625,4.366h-2.683l3.957-6.36-3.74-6.299h2.752l2.364,4.052,2.439-4.052h2.47Zm5.018,16.346h-2.422V9.968h2.422v15.475Zm5.215,0V12.197h-2.787v-2.229h2.787v-2.811c0-1.146.32-2.057.962-2.732s1.486-1.013,2.531-1.013h2.652v2.413h-2.652c-.768,0-1.151.444-1.151,1.332v2.811h3.473v2.229h-3.473v13.246h-2.342Zm8.598-19.327h2.423v19.327h-2.423V6.116Zm15.527,15.288c-.637,1.118-1.463,1.955-2.477,2.509-1.014.554-2.105.832-3.271.832-2.297,0-3.913-.912-4.846-2.738-.072-.142-.162-.214-.269-.214s-.162.054-.162.161v7.489h-2.423V9.968h2.423v2.389c0,.107.054.161.162.161s.197-.072.269-.214c.933-1.826,2.549-2.738,4.846-2.738,1.166,0,2.257.278,3.271.832,1.014.554,1.839,1.391,2.477,2.51.637,1.118.956,2.466.956,4.039s-.319,2.921-.956,4.04Zm-2.8-7.892c-.889-.922-2.06-1.383-3.513-1.383s-2.625.461-3.513,1.383c-.889.922-1.215,2.206-1.215,3.852s.326,2.931,1.215,3.852c.889.922,2.06,1.383,3.513,1.383s2.625-.46,3.513-1.383c.889-.922,1.333-2.206,1.333-3.852s-.444-2.93-1.333-3.852Z"/></svg>`,

  // Wikipedia's puzzle-globe is too heavy to inline (147 KB). The wordmark
  // version below uses a serif text approximation in the brand's style.
  wikipedia: `<div class="wiki-wordmark"><div class="wiki-name">WIKIPEDIA</div><div class="wiki-tag">The Free Encyclopedia</div></div>`,
};

// Pool of mock results. Some include `subPages` (rendered as sitelinks beneath
// the main result, mimicking the way real engines treat high-authority hits).
const POOL = [
  {
    url: "rtings.com", title: "Best Wireless Headphones - RTINGS.com",
    snippet: "Our test bench compares the latest wireless models on noise cancellation, battery life, comfort and call quality, with measured frequency response graphs.",
    subPages: [
      { title: "Over-ear", url: "rtings.com/headphones/best/over-ear" },
      { title: "In-ear", url: "rtings.com/headphones/best/in-ear" },
      { title: "For working out", url: "rtings.com/headphones/best/workout" },
      { title: "For commuting", url: "rtings.com/headphones/best/commuting" },
    ],
  },
  { url: "theverge.com", title: "The best wireless headphones to buy in 2026",
    snippet: "Expert reviews of every major model, with comparisons against last year's flagships and the pros and cons that matter day to day." },
  { url: "reddit.com", title: "Best wireless headphones under £200? : r/headphones",
    snippet: "Community-vetted recommendations across budgets, with regular megathreads breaking down the trade-offs of each option." },
  { url: "whathifi.com", title: "Best wireless headphones 2026: top noise-cancelling picks",
    snippet: "Hands-on buyer's guide grouped by price tier and updated quarterly as new models come in for testing." },
  { url: "en.wikipedia.org", title: "Headphones - Wikipedia",
    snippet: "Overview, history, and technical details of the category and its key players, with citations to authoritative sources." },
  { url: "youtube.com", title: "Top 5 Wireless Headphones 2026 - Hands-on Comparison",
    snippet: "Long-form video walkthrough with sound comparisons, ANC tests and microphone samples in different environments." },
  { url: "head-fi.org", title: "Wireless headphones discussion thread - Head-Fi",
    snippet: "Audiophile forum thread with measurements, frequency response graphs and impressions from long-time users." },
  { url: "cnet.com", title: "Best Wireless Headphones for 2026 - CNET",
    snippet: "We tested 24 pairs of wireless headphones to find the best for music, calls and noise cancellation across every budget." },
  { url: "tomsguide.com", title: "Best wireless headphones 2026: top picks tested",
    snippet: "Our editors break down the strongest contenders in audio quality, battery life, fit and value." },
  {
    url: "amazon.com", title: "Wireless Headphones | Amazon.com",
    snippet: "Shop a huge selection of over-ear, on-ear and in-ear wireless headphones from top brands, with fast delivery and easy returns.",
    subPages: [
      { title: "Over-ear", url: "amazon.com/headphones/over-ear" },
      { title: "Earbuds", url: "amazon.com/headphones/earbuds" },
      { title: "Best sellers", url: "amazon.com/bestsellers/headphones" },
      { title: "New releases", url: "amazon.com/new-releases/headphones" },
    ],
  },
  {
    url: "sony.com", title: "Wireless Headphones | Sony US",
    snippet: "Explore Sony's range of wireless headphones, including the WH-1000XM6 flagship and the new LinkBuds family.",
    subPages: [
      { title: "WH-1000XM6", url: "sony.com/wh-1000xm6" },
      { title: "LinkBuds S", url: "sony.com/linkbuds-s" },
      { title: "Compare models", url: "sony.com/compare/headphones" },
    ],
  },
  { url: "bose.com", title: "Wireless Headphones | Bose",
    snippet: "Discover Bose's flagship QuietComfort Ultra and Soundlink wireless ranges with proprietary CustomTune calibration." },
  { url: "sennheiser.com", title: "Wireless Headphones | Sennheiser",
    snippet: "Audiophile-focused wireless headphones with high-resolution codecs and a 30-year heritage in studio audio." },
  { url: "apple.com", title: "AirPods Max - Apple",
    snippet: "Active noise cancellation, spatial audio with dynamic head tracking and seamless integration with iPhone, iPad and Mac." },
  { url: "engadget.com", title: "Best wireless headphones for 2026 - Engadget",
    snippet: "We compare new releases against last year's picks and call out which ones are worth the upgrade." },
  { url: "wired.com", title: "The best wireless headphones, tested and reviewed",
    snippet: "Long-term testing notes from WIRED editors covering travel use, gym workouts, video calls and critical listening." },
  { url: "soundguys.com", title: "Best wireless headphones - SoundGuys",
    snippet: "Measurement-led recommendations with full isolation curves and codec support breakdowns." },
  { url: "techradar.com", title: "Best wireless headphones 2026: top picks for music & calls",
    snippet: "From budget runner-ups to flagship over-ears, here are TechRadar's recommended pairs for every situation." },
  { url: "digitaltrends.com", title: "The best wireless headphones for 2026 - Digital Trends",
    snippet: "Compares ANC strength, comfort over long sessions and codec support to find the right pair for your phone." },
  { url: "audiosciencereview.com", title: "Wireless headphone measurements & reviews",
    snippet: "Independent measurements and listening notes covering frequency response, distortion and Bluetooth latency." },
  { url: "nytimes.com", title: "Wirecutter: The Best Wireless Headphones",
    snippet: "After testing more than 200 pairs over a decade, here are the picks our editors recommend right now." },
  { url: "consumerreports.org", title: "Best Headphones Ratings - Consumer Reports",
    snippet: "Lab-tested ratings for sound quality, noise reduction and durability, refreshed quarterly with the latest models." },
  { url: "forbes.com", title: "The 10 Best Wireless Headphones Of 2026 - Forbes",
    snippet: "Picks across categories: best overall, best ANC, best for calls, best budget, best for sport and best for gaming." },
  { url: "reuters.com", title: "Wireless headphone market analysis 2026 - Reuters",
    snippet: "Shipments rose 6% year-on-year as mid-range models matched flagship spec sheets at meaningfully lower price points." },
  { url: "audio-technica.com", title: "Wireless Headphones | Audio-Technica",
    snippet: "Studio-derived wireless models with low-latency codecs, balanced tuning and replaceable earpads." },
  { url: "beats.com", title: "Beats Wireless Headphones | Beats by Dre",
    snippet: "Studio Pro, Solo 4 and Beats Fit Pro with Apple-style pairing and personalised spatial audio." },
  { url: "lifewire.com", title: "The 9 Best Wireless Headphones of 2026 - Lifewire",
    snippet: "Quick picks based on what most listeners actually care about: comfort, noise cancellation and easy pairing." },
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(n) {
  return shuffle(POOL).slice(0, n);
}

function aiOverviewText(q) {
  return `Top-rated picks for <strong>${escapeHtml(q)}</strong> in 2026 typically combine over-ear comfort, 30+ hours of battery and competent active noise cancellation. Reviewers from RTINGS, The Verge and What Hi-Fi consistently put Sony's flagship WH series, Sennheiser's Accentum and the Anker Soundcore Space Q45 at the top of the value tier. Mid-range models now match older flagships for everyday use; the remaining trade-offs are microphone clarity, LDAC support and case durability. <a href="#">Learn more</a>.`;
}

function commonResultsHtml(results, urlColor, titleColor) {
  return results.map((r) => `
    <div class="result">
      <div class="url" style="color:${urlColor}">${escapeHtml(r.url)}</div>
      <div class="title" style="color:${titleColor}">${escapeHtml(r.title)}</div>
      <div class="snippet">${escapeHtml(r.snippet)}</div>
      ${r.subPages ? `
        <div class="subpages">
          ${r.subPages.map((s) => `
            <div class="subpage">
              <div class="subpage-title" style="color:${titleColor}">${escapeHtml(s.title)}</div>
              <div class="subpage-url" style="color:${urlColor}">${escapeHtml(s.url)}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `).join("");
}

const baseStyles = `
  body { margin: 0; padding: 18px 22px; }
  .header { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
  .logo { flex: none; height: 30px; display: inline-flex; align-items: center; }
  .logo svg { height: 30px; width: auto; display: block; }
  .searchbox { flex: 1; min-width: 0; max-width: 580px; padding: 8px 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wiki-wordmark { font: 22px/1 'Linux Libertine','Linux Libertine O','Georgia',serif; color: #000; letter-spacing: 2px; }
  .wiki-wordmark .wiki-tag { font: italic 9px/1 Georgia, serif; letter-spacing: 0; color: #5a5a5a; margin-top: 4px; }
  .stats { font-size: 12px; margin-bottom: 16px; }
  .result { margin-bottom: 22px; max-width: 640px; }
  .url { font-size: 12px; }
  .title { font-size: 18px; margin: 2px 0; }
  .snippet { font-size: 13px; }
  .subpages { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-top: 8px; padding-left: 12px; }
  .subpage-title { font-size: 14px; margin-bottom: 2px; }
  .subpage-url { font-size: 11px; }
  /* Progressive-reveal — header fades in first, body shortly after, AI
     overview (Google only) a touch later with a faster fade. CSS-only so
     extension CSP can't block it. The per-pane delays are inlined as a
     style attribute so each iframe stays slightly out of sync. */
  @keyframes scFadeIn { to { opacity: 1; } }
  .fade-header, .fade-body { opacity: 0; animation: scFadeIn 260ms ease forwards; }
  .fade-ai { opacity: 0; animation: scFadeIn 180ms ease-out forwards; }
`;

function revealDelays() {
  return {
    header: Math.round(140 + Math.random() * 220),
    body: Math.round(550 + Math.random() * 450),
    ai: Math.round(1500 + Math.random() * 900),
  };
}

function googleHTML(q) {
  const results = pick(8);
  const d = revealDelays();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_top"/><style>
    body { font: 14px/1.5 Arial,"Helvetica Neue",sans-serif; color: #202124; }
    .searchbox { border: 1px solid #dfe1e5; border-radius: 999px; color: #202124; }
    .ai { max-width: 640px; margin-bottom: 24px; padding: 14px 16px; background: #f1f3f4; border-radius: 12px; }
    .ai-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #5f6368; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
    .ai-label::before { content: ""; width: 12px; height: 12px; background: conic-gradient(from 0deg,#4285F4,#EA4335,#FBBC05,#34A853,#4285F4); border-radius: 50%; }
    .ai p { margin: 0; font-size: 13px; line-height: 1.55; color: #202124; }
    .ai a { color: #1a73e8; text-decoration: none; }
    .stats { color: #70757a; }
    .snippet { color: #4d5156; }
    .subpages { border-left: 2px solid #e8eaed; }
    ${baseStyles}
  </style></head><body>
    <div class="header fade-header" style="animation-delay:${d.header}ms">
      <div class="logo">${LOGOS.google}</div>
      <div class="searchbox">${escapeHtml(q)}</div>
    </div>
    <div class="fade-body" style="animation-delay:${d.body}ms">
      <div class="ai fade-ai" style="animation-delay:${d.ai}ms">
        <div class="ai-label">AI overview</div>
        <p>${aiOverviewText(q)}</p>
      </div>
      <div class="stats">About 12,400,000 results (0.42 seconds)</div>
      ${commonResultsHtml(results, "#006621", "#1a0dab")}
    </div>
  </body></html>`;
}

function bingHTML(q) {
  const results = pick(9);
  const d = revealDelays();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_top"/><style>
    body { font: 14px/1.5 "Segoe UI", system-ui, sans-serif; color: #2b2b2b; }
    .searchbox { border: 1px solid #d2d2d2; border-radius: 8px; color: #2b2b2b; }
    .stats { color: #767676; }
    .snippet { color: #444; }
    .subpages { border-left: 2px solid #e3e3e3; }
    ${baseStyles}
  </style></head><body>
    <div class="header fade-header" style="animation-delay:${d.header}ms">
      <div class="logo">${LOGOS.bing}</div>
      <div class="searchbox">${escapeHtml(q)}</div>
    </div>
    <div class="fade-body" style="animation-delay:${d.body}ms">
      <div class="stats">12,400,000 results · 0.39 sec</div>
      ${commonResultsHtml(results, "#008272", "#2330a8")}
    </div>
  </body></html>`;
}

function genericHTML(engineId, q) {
  const results = pick(8);
  const d = revealDelays();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_top"/><style>
    body { font: 14px/1.5 system-ui, -apple-system, sans-serif; color: #1f1f1f; }
    .searchbox { border: 1px solid #d2d2d2; border-radius: 8px; color: #1f1f1f; }
    .stats { color: #777; }
    .snippet { color: #4d5156; }
    .subpages { border-left: 2px solid #e8eaed; }
    ${baseStyles}
  </style></head><body>
    <div class="header fade-header" style="animation-delay:${d.header}ms">
      <div class="logo">${LOGOS[engineId] || ""}</div>
      <div class="searchbox">${escapeHtml(q)}</div>
    </div>
    <div class="fade-body" style="animation-delay:${d.body}ms">
      <div class="stats">About 8,200,000 results</div>
      ${commonResultsHtml(results, "#006621", "#1a0dab")}
    </div>
  </body></html>`;
}

// Realistic Target-store results used by the "Did you mean" simulation.
const TARGET_POOL = [
  { url: "target.com", title: "Target : Expect More. Pay Less.",
    snippet: "Shop Target online and in-store for everything from groceries and essentials to clothing, home decor and electronics. Free 2-day shipping on orders $35+.",
    subPages: [
      { title: "Grocery", url: "target.com/c/grocery" },
      { title: "Weekly Ad", url: "target.com/weekly-ad" },
      { title: "Find a store", url: "target.com/store-locator" },
      { title: "RedCard", url: "target.com/redcard" },
    ],
  },
  { url: "en.wikipedia.org", title: "Target Corporation - Wikipedia",
    snippet: "American retail corporation operating a chain of discount department stores and hypermarkets, headquartered in Minneapolis, Minnesota." },
  { url: "target.com/c/grocery", title: "Grocery : Target",
    snippet: "Fresh produce, pantry staples, frozen meals and household essentials with free order pickup and same-day delivery from your local store." },
  { url: "target.com/c/clothing", title: "Women's Clothing : Target",
    snippet: "Discover new arrivals from Universal Thread, Wild Fable, A New Day and more, all priced for everyday value." },
  { url: "corporate.target.com", title: "Target Corporate | Target Corporation",
    snippet: "Learn about Target's leadership, careers, sustainability commitments, investor relations and press releases." },
  { url: "reddit.com/r/Target", title: "Target - Reddit",
    snippet: "Community for Target team members and guests. Discussion of policies, deals, store culture and workplace life." },
  { url: "forbes.com/companies/target", title: "Target Corporation Profile - Forbes",
    snippet: "Profile of the discount retailer with revenue, market cap, recent news and quarterly performance." },
  { url: "target.com/p/airpods-max", title: "AirPods Max - Target",
    snippet: "Buy AirPods Max at Target with free shipping or in-store pickup. Choose from five colours, with care plan options at checkout." },
  { url: "target.com/c/electronics", title: "Electronics : Target",
    snippet: "Shop TVs, headphones, gaming consoles, smart home gear and accessories with everyday low prices." },
  { url: "target.com/c/home", title: "Home : Target",
    snippet: "Furniture, bedding, kitchenware and decor from threshold, Studio McGee and Project 62 collections." },
];

function targetResultsHtml(urlColor, titleColor) {
  const results = shuffle(TARGET_POOL).slice(0, 8);
  // Ensure target.com (with sub-pages) is in the first spot.
  const main = TARGET_POOL[0];
  if (!results.find((r) => r.url === main.url)) results.unshift(main);
  else {
    const idx = results.findIndex((r) => r.url === main.url);
    if (idx > 0) { results.splice(idx, 1); results.unshift(main); }
  }
  return commonResultsHtml(results.slice(0, 8), urlColor, titleColor);
}

function googleDidYouMeanHTML(q) {
  const d = revealDelays();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_top"/><style>
    body { font: 14px/1.5 Arial,"Helvetica Neue",sans-serif; color: #202124; }
    .searchbox { border: 1px solid #dfe1e5; border-radius: 999px; color: #202124; }
    .dym { max-width: 640px; margin-bottom: 4px; font-size: 18px; color: #202124; }
    .dym strong { color: #c5221f; font-style: italic; font-weight: 600; }
    .dym a { color: #1a0dab; font-style: italic; text-decoration: none; }
    .dym a:hover { text-decoration: underline; }
    .instead { max-width: 640px; margin-bottom: 14px; font-size: 13px; color: #4d5156; }
    .instead em { font-style: italic; }
    .stats { color: #70757a; }
    .snippet { color: #4d5156; }
    .subpages { border-left: 2px solid #e8eaed; }
    ${baseStyles}
  </style></head><body>
    <div class="header fade-header" style="animation-delay:${d.header}ms">
      <div class="logo">${LOGOS.google}</div>
      <div class="searchbox">${escapeHtml(q)}</div>
    </div>
    <div class="fade-body" style="animation-delay:${d.body}ms">
      <div class="dym">Showing results for <a href="#">target</a><br/>Search instead for <strong>${escapeHtml(q)}</strong></div>
      <div class="stats">About 1,420,000,000 results (0.38 seconds)</div>
      ${targetResultsHtml("#006621", "#1a0dab")}
    </div>
  </body></html>`;
}

function firefoxDnfHTML(d) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_top"/><style>
    html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
    body { font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #15141a; }
    .wrap { max-width: 580px; margin: 0; padding: 64px 56px 0; }
    .icon { width: 56px; height: 56px; margin-bottom: 22px; color: #FFA436; }
    h1 { font-size: 28px; font-weight: 600; margin: 0 0 14px; letter-spacing: -0.01em; line-height: 1.2; color: #15141a; }
    p { font-size: 14px; color: #5b5b66; margin: 0 0 12px; }
    .url { font-weight: 600; color: #15141a; }
    ul { padding-left: 22px; color: #5b5b66; margin: 0 0 22px; }
    li { margin-bottom: 6px; }
    .btn { display: inline-block; margin-top: 4px; padding: 8px 18px; background: #0061e0; color: #fff; border: none; border-radius: 4px; font-weight: 600; font-size: 14px; }
  </style></head><body>
    <div class="wrap">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <h1>Hmm. We're having trouble finding that site.</h1>
      <p>We can't connect to the server at <span class="url">${escapeHtml(d || "the requested address")}</span>.</p>
      <p>If you entered the right address, you can:</p>
      <ul>
        <li>Try again later</li>
        <li>Check your network connection</li>
        <li>Check that Firefox has permission to access the web (you might be connected but behind a firewall)</li>
      </ul>
      <button class="btn">Try Again</button>
    </div>
  </body></html>`;
}

const builders = {
  google: (q) => googleHTML(q),
  bing: (q) => bingHTML(q),
  ddg: (q) => genericHTML("ddg", q),
  amazon: (q) => genericHTML("amazon", q),
  wikipedia: (q) => genericHTML("wikipedia", q),
  perplexity: (q) => genericHTML("perplexity", q),
  "google-didyoumean": (q) => googleDidYouMeanHTML(q),
  "firefox-dnf": () => firefoxDnfHTML(domain),
};

function pageFor(engineId, q) {
  const builder = builders[engineId] || builders.google;
  return builder(q);
}

// Stagger each iframe with its own random "network" delay before the document
// arrives. Each pane's delay is different so neither side feels in lockstep.
const leftDelay = 120 + Math.random() * 480;
let rightDelay = 120 + Math.random() * 480;
while (Math.abs(leftDelay - rightDelay) < 120) {
  rightDelay = 120 + Math.random() * 480;
}
setTimeout(() => { document.getElementById("left").srcdoc = pageFor(leftId, query); }, leftDelay);
setTimeout(() => { document.getElementById("right").srcdoc = pageFor(rightId, query); }, rightDelay);
