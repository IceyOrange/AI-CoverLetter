# !/usr/bin/env python
# -*-coding:utf-8 -*-
# @File    :   AccessLLM.py
# @Author  :   O_Orange 
# @Time    :   2025/02/25 09:26:53

import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.embeddings.base import Embeddings
# from langchain_community.llms import Ollama
from dotenv import load_dotenv
load_dotenv()

OPENAI_API_BASE = os.getenv('OPENAI_API_BASE')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
MODEL_NAME = os.getenv('MODEL_NAME')
CV_PATH = os.getenv("CV_PATH")

class M3EEmbedding(Embeddings):  # 定义 M3EEmbedding 类
    def __init__(self, model):
        self.model = model

    def embed_documents(self, texts):
        return self.model.encode(texts, normalize_embeddings=True).tolist()

    def embed_query(self, text):
        return self.model.encode([text], normalize_embeddings=True)[0].tolist()


def Parse_Embed_CV(file_path):
    doc = fitz.open(file_path)
    text = ""
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text += page.get_text("text")  # 提取纯文本

    # 将文本分块为适合 LLM 处理的片段
    text_splitter = RecursiveCharacterTextSplitter(
        separators = '\n',
        chunk_size = 1000,  # 每块大小
        chunk_overlap = 200  # 块间重叠
    )
    text_chunks = text_splitter.split_text(text)
    
    # 使用 M3E-base 作为词嵌入模型
    m3e_model = SentenceTransformer(model_name_or_path='D:/m3e-base', device="cuda")
    embedding_function = M3EEmbedding(m3e_model)
    vectorstore = FAISS.from_texts(text_chunks, embedding = embedding_function)
    return text, vectorstore


def Generate_Context(CV_text, CV_Embedding, JD):
    character_limit = 300  # 字数限制
    
    langchain_prompt_template = f"""
        你将扮演一位求职者的角色,根据上下文里的简历内容以及应聘工作的描述,来直接给HR写一个礼貌专业, 且字数严格限制在{character_limit}以内的求职消息,要求能够用专业的语言结合简历中的经历和技能,并结合应聘工作的描述,来阐述自己的优势,尽最大可能打动招聘者。始终使用中文来进行消息的编写。开头是招聘负责人, 结尾附上求职者邮箱。这是一份求职消息，不要包含求职内容以外的东西,例如“根据您上传的求职要求和个人简历,我来帮您起草一封求职邮件：”这一类的内容，也不要此致敬礼等类似过于正式的落款, 邮箱后面不要有任何内容! 不要用Markdown格式输出, 我不想被HR看出来是使用AI生成的这段文字。
        工作描述:
        {JD}"""+"""
        简历内容:
        {context}
        要求:
        {question} 
    """
    question = "根据工作描述，寻找出简历里最合适的技能都有哪些?求职者的优势是什么?"

    PROMPT = PromptTemplate.from_template(langchain_prompt_template)
    
    llm = ChatOpenAI(  # 通过 API 调用 LLM 大模型
        openai_api_base = OPENAI_API_BASE,
        openai_api_key= OPENAI_API_KEY,
        model = MODEL_NAME
    )

    # llm = Ollama(base_url='http://localhost:11434', model="deepseek-r1:1.5b")  # 通过 Ollama 调用本地 LLM 大模型

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=CV_Embedding.as_retriever(),
        chain_type="stuff",
        chain_type_kwargs={"prompt": PROMPT}
    )

    result = qa_chain.invoke({"query": question})
    letter = result['result']
    letter = letter.replace('\n', ' ')  # 去掉所有换行符，防止分成多段消息
    return letter


if __name__ == '__main__':
    JD = """
        一、工作内容
        1、机械设备智能化、自动化方面项目需求分析、系统设计及核心代码的编写，解决项目开发过程中的技术问题；
        2.算法设计：针对具体应用场景，设计算法并提升其效果/效率/稳定性
        二、任职条件：
        1.计算机/自动化/电子信息/数学/等工科相关专业，本科及以上学历，有2年以上软件开发经验；
        2.熟练掌握C/C++/Matlab/Python/GoLang至少一种，动手能力强；
        3.熟悉常用CV库和深度学习框架（Caffe/PyTorch/TensorFlow等）；
    """  # 用于测试
    CV_context, CV_Embedding = Parse_Embed_CV(CV_PATH)
    Letter = Generate_Context(CV_context, CV_Embedding, JD)
    print(Letter)
