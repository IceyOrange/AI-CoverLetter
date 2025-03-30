// ==UserScript==
// @name         BOSS直聘职位描述提取
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  提取BOSS直聘职位描述
// @author       Your Name
// @match        https://www.zhipin.com/*
// @grant        none
// ==/UserScript==


// 优化空间：目前只适配了BOSS直聘，后续可以适配猎聘等其它招聘网站。
function fetchJobDescription(callback) {
    function getJobDescription() {
        const jobDescriptionElement = document.querySelector('div.job-detail-body p.desc');
        return jobDescriptionElement ? jobDescriptionElement.innerText.trim() : null;
    }

    // 监听 DOM 变化
    const observer = new MutationObserver(() => {
        const jobDescription = getJobDescription();
        if (jobDescription) {
            callback(jobDescription); // 触发回调，传入最新的 JD
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 初始调用，避免错过已经加载的 JD
    const initialJD = getJobDescription();
    if (initialJD) {
        callback(initialJD);
    }
}

// 使用示例
fetchJobDescription(jobDescription => {
    console.log('最新职位描述:', jobDescription);
});
