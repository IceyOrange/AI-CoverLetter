# !/usr/bin/env python
# -*-coding:utf-8 -*-
# @File    :   SeleniumRPA.py
# @Author  :   O_Orange 
# @Time    :   2025/02/24 19:45:06

import AccessLLM  # 导入本地库

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver import ActionChains
from selenium.webdriver import Keys
import os
import time
import random
from dotenv import load_dotenv

load_dotenv()
JOB_LABEL = os.getenv('JOB_LABEL')


def OpenBrowser():
    global driver
    options = Options()
    # options.add_argument("--headless")  # 无头浏览器
    options.add_experimental_option("detach", True)  # 阻止浏览器在代码运行后自动关闭
    driver = webdriver.Chrome(options=options)
    driver.maximize_window()
    return driver

def OpenBossRecommendPage():
    url = "https://www.zhipin.com/web/geek/job-recommend?ka=header-job-recommend"
    driver.get(url)
    # 等待直到页面右上角"登录/注册"按钮加载完毕
    login_button_xpath_locator = "//*[@id='header']/div[1]/div[3]/div/a"
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, login_button_xpath_locator))
    )

def WechatLogin():
    global driver
    # 点击页面右上角"登录/注册"按钮
    driver.find_element(By.XPATH, "//*[@id='header']/div[1]/div[3]/div/a").click()

    # 等待"微信登录/注册"按钮出现, 并在出现后点击
    wechat_login_xpath_locator = "//*[@id='wrap']/div/div[2]/div[2]/div[2]/div[1]/div[4]/a"
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, wechat_login_xpath_locator))
    )
    time.sleep(random.random())
    driver.find_element(By.XPATH, wechat_login_xpath_locator).click()

    # 等待BOSS直聘微信小程序二维码加载
    WeChat_Mini_Program_QRCode_xpath_locator = "//*[@id='wrap']/div/div[2]/div[2]/div[1]/div[2]/div[1]/img"
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, WeChat_Mini_Program_QRCode_xpath_locator))
    )
    time.sleep(random.random())

    # 等待完成扫码登录操作, 最长等待60s
    xpath_locator_login_success = "//*[@id='header']/div[1]/div[3]/ul/li[2]/a"
    WebDriverWait(driver, 60).until(
        EC.presence_of_element_located((By.XPATH, xpath_locator_login_success))
    )


def Job_Filter():
    global driver
    # 在获取JD之前先要筛选岗位, 如只看招聘应届生的岗位
    Work_Experience_Filter_xpath_locator = '//span[@class="placeholder-text" and text()="工作经验"]'
    driver.find_element(By.XPATH, Work_Experience_Filter_xpath_locator).click()
    time.sleep(random.random() + 1)
    driver.find_element(By.XPATH, '//div[@class="filter-select-dropdown"]/ul/li[contains(text(), "应届生")]').click()
    time.sleep(random.random())
    ActionChains(driver).move_by_offset(100, 100).perform()  # 挪开鼠标
    time.sleep(random.random())
    ActionChains(driver).move_by_offset(-100, -100).perform()  # 挪回鼠标

    time.sleep(random.random())

    # 在获取JD之前先要筛选岗位, 如只看学历本科的岗位
    Work_Experience_Filter_xpath_locator = '//span[@class="placeholder-text" and text()="学历要求"]'
    driver.find_element(By.XPATH, Work_Experience_Filter_xpath_locator).click()
    time.sleep(random.random() + 1)
    driver.find_element(By.XPATH, '//div[@class="filter-select-dropdown"]/ul/li[contains(text(), "本科")]').click()
    time.sleep(random.random())
    ActionChains(driver).move_by_offset(100, 100).perform()  # 挪开鼠标
    time.sleep(random.random())
    ActionChains(driver).move_by_offset(-100, -100).perform()  # 挪回鼠标

    # 选择你之前添加的意向岗位, 如 '数据分析师'
    label = JOB_LABEL  # 测试
    if label not in driver.find_element(By.XPATH, '//*[@id="wrap"]/div[2]/div[1]/div/div[1]/div/div/span/span').text:
        trigger_selector = "//*[@id='wrap']/div[2]/div[1]/div/div[1]/div"
        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, trigger_selector))
        ).click()  # 打开下拉菜单
        dropdown_selector = "ul.dropdown-expect-list"
        WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, dropdown_selector))
        )
        option_selector = f"//*[@id='wrap']//span[contains(text(), '{label}')]"
        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, option_selector))
        ).click()  # 选择下拉菜单中的选项

    # 其它筛选条件请自行拓展 ~


def Get_JD():
    print("\n<<==开始获取该职位JD信息==>>")
    global driver

    JD_xpath_locator = "//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[2]/p"
    JD_element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, JD_xpath_locator))
    )
    JD_description = JD_element.text
    print(JD_description)
    print("<<==该职位JD信息获取完成==>>\n")
    return JD_description


def Get_Job_tree():
    global driver
    Jod_tree_xpath_locator = '//ul[@class="rec-job-list"]/div'
    return driver.find_elements(By.XPATH, Jod_tree_xpath_locator)  # Job_tree为职位列表    


def send_response_and_go_back(driver, response):
    time.sleep(random.random() + 1)
    chat_box = WebDriverWait(driver, 10).until(  # 定位聊天输入框
        EC.presence_of_element_located((By.XPATH, "//*[@id='chat-input']"))
    )
    chat_box.clear()  # 清除输入框中可能存在的任何文本  
    chat_box.send_keys(response)  # 将响应粘贴到输入框
    time.sleep(3 + random.random())
    chat_box.send_keys(Keys.ENTER)  # 发送内容
    time.sleep(5 + random.random())
   
    driver.back()  # 返回到上一个页面 发现返回后会自动刷新 又要重新筛选 可恶
    time.sleep(3 + random.random())


def Scroll_Click(CV_context, CV_Embedding):
    global driver
    """遍历职位列表并点击每个职位"""
    Jod_tree_xpath_locator = '//ul[@class="rec-job-list"]/div'
    WebDriverWait(driver, 10).until(  # 等待加载
        EC.presence_of_element_located((By.XPATH, Jod_tree_xpath_locator))
    )
    # 将鼠标移动到职位列表，以确保滚动有效
    ActionChains(driver).move_to_element(driver.find_element(By.XPATH, Jod_tree_xpath_locator)).perform()
    Job_tree = Get_Job_tree()  # 初始职位列表
    count = 0  

    while True:
        time.sleep(random.random() + 5)
        Job_tree = Get_Job_tree()  # 每次循环都重新获取最新的职位列表
        if count >= len(Job_tree):  # 如果所有职位都已遍历，退出循环
            break

        print(f"当前职位列表数量: {len(Job_tree)}，正在点击第 {count + 1} 个职位")
    
        if Job_tree[count].is_displayed():  # 确保元素可见
            Job_tree[count].click()
        else:
            Job_tree[count].scrollIntoView()
            time.sleep(random.uniform(0.5, 1.5))  # 模拟用户行为
            Job_tree[count].click()
        
        JD = Get_JD()  # 获取职位详情

        try:  # 不看教培
            Tags = driver.find_element(By.XPATH, '//ul[@class="job-label-list"]').text
            if '教师资格证' in Tags or '培训机构' in Tags or '教师' in Tags or '线下教育' in Tags:
                count += 1  # 不看教培
                continue
        except:
            pass

        if '初中' in JD or '高中' in JD or '教师' in JD or '教学' in JD or '班主任' in JD:  # 不看教培
            count += 1
            continue
            
        # 之前聊过的就不聊了
        try:
            time.sleep(0.5 + random.random())
            driver.find_element(By.XPATH, "//div/a[contains(text(), '立即沟通')]").click()
        except:
            count += 1  # 处理已沟通过的
            continue

        Context = AccessLLM.Generate_Context(CV_context, CV_Embedding, JD)  # 生成话术
        print(Context)
        
        time.sleep(0.5 + random.random())  # 第一次沟通, 需要点击"继续沟通按钮"
        if driver.find_element(By.XPATH, "//div[@class='greet-boss-header']/h3[contains(text(), '已向BOSS发送消息')]").is_displayed():
            driver.find_element(By.XPATH, "//div[@class='greet-boss-footer']/a[contains(text(), '继续沟通')]").click()

        send_response_and_go_back(driver, Context)  # 沟通并返回
        time.sleep(random.random())
        # Job_Filter()  # 有时候回退后会清楚筛选条件, 有时候又不会……
        count += 1  # 仅在成功点击后才递增

    print("所有职位遍历完成")


def Web_Page_Action():
    CV_context, CV_Embedding = AccessLLM.Parse_Embed_CV('./CV.pdf')  # 先解析简历
    OpenBrowser()  # 打开浏览器
    OpenBossRecommendPage()  # 打开BOSS直聘的推荐页面
    WechatLogin()  # 微信登录
    Job_Filter()  # 筛选
    Scroll_Click(CV_context, CV_Embedding)  # 滚动 + 点击 + 获取岗位信息


if __name__ == '__main__':
    Web_Page_Action()
