// Force inline SVG so it can be styled properly
document.querySelectorAll("use").forEach(el => {
    if (el.getAttribute("href").includes("#icon-")) {
        el.setAttribute("href", el.getAttribute("href").replace(/.*#/, "#"));
    }
})
