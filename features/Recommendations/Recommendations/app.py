import os
from typing import List, Literal, Optional

import pandas as pd
import streamlit as st
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from basket import CATEGORY_WEIGHTS, MIN_BUDGET, build_basket, duration_to_days, format_basket, prepare_data

st.set_page_config(page_title="Cyborg Smart Cart", page_icon="🛒")
st.title("🛒 مساعد Cyborg الذكي للسوبر ماركت")

api_key = st.sidebar.text_input("أدخل مفتاح OpenAI API الخاص بك:", type="password")

if not api_key:
    st.warning("رجاءً أدخل مفتاح OpenAI API في القائمة الجانبية لتشغيل النظام.")
    st.stop()

os.environ["OPENAI_API_KEY"] = api_key


@st.cache_data
def load_data():
    excel_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "super_market_data_filled.xlsx")
    raw = pd.read_excel(
        excel_file,
        sheet_name="products",
        usecols=["ArabicPrtoductName", "ArabicCategory", "ArabicSubCategory", "price"],
    )
    return prepare_data(raw)


df = load_data()

categories_list = "، ".join(CATEGORY_WEIGHTS)


class CartInput(BaseModel):
    budget: float = Field(description="الميزانية الكلية بالجنيه كرقم، مثل 2000")
    categories: Optional[List[str]] = Field(
        default=None,
        description="الأقسام التي ذكرها العميل بكلماته مثل ألبان، بقوليات، خضار، عصائر. اتركها فارغة تماماً لو العميل لم يحدد أقساماً.",
    )
    duration: float = Field(
        default=1,
        description="رقم المدة كما قالها العميل بالظبط، ونص تتكتب 0.5 (مثال: سنة ونص = 1.5). لو لم يذكر مدة اتركها 1 مع unit=month.",
    )
    unit: Literal["second", "minute", "hour", "day", "week", "month", "year"] = Field(
        default="month",
        description="وحدة المدة كما قالها العميل بالظبط ولا تحوّلها بنفسك: ثانية second، دقيقة minute، ساعة hour، يوم day، أسبوع week، شهر month، سنة year.",
    )


def smart_cart(budget: float, categories: Optional[List[str]] = None, duration: float = 1, unit: str = "month") -> str:
    try:
        days = duration_to_days(duration, unit)
    except ValueError as e:
        return f"❌ {e}"
    if budget < MIN_BUDGET:
        return f"❌ الميزانية صغيرة جداً، اكتب مبلغ أكبر من {MIN_BUDGET} جنيه."
    result = build_basket(df, budget, categories, days)
    return format_basket(result)


smart_cart_tool = StructuredTool.from_function(
    func=smart_cart,
    name="smart_cart_tool",
    description=(
        "تبني سلة مشتريات تستهلك الميزانية كاملة تقريباً. استخدمها عند أي طلب ترشيح منتجات أو سلة. "
        f"الأقسام المتاحة: {categories_list}. "
        "لو العميل حدد أقساماً فمرّرها فقط ولا تضف أقساماً أخرى."
    ),
    args_schema=CartInput,
)

llm = ChatOpenAI(temperature=0, model="gpt-4o-mini")
tools = [smart_cart_tool]

prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "أنت مساعد لشركة Cyborg متخصص في ترشيح منتجات السوبر ماركت. "
        "استخرج الميزانية والأقسام المطلوبة والمدة من كلام العميل ثم استدعِ الأداة. مرّر المدة والوحدة كما قالها العميل بالظبط حتى لو كانت غير منطقية، فالأداة هي اللي تقبلها أو ترفضها. "
        "لا تضف أقساماً لم يطلبها العميل. لو لم يذكر ميزانية اسأله عنها بجملة قصيرة.",
    ),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    return_intermediate_steps=True,
)

if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

if prompt_input := st.chat_input("مثال: بـ 2000 جنيه ألبان وبقوليات لمدة شهر"):
    st.chat_message("user").markdown(prompt_input)
    st.session_state.messages.append({"role": "user", "content": prompt_input})

    with st.chat_message("assistant"):
        with st.spinner("جاري تجهيز السلة..."):
            try:
                response = agent_executor.invoke({"input": prompt_input})
                steps = response.get("intermediate_steps", [])
                final_response = steps[-1][1] if steps else response["output"]
            except Exception as e:
                final_response = f"حدث خطأ: {e}"
        st.markdown(final_response)
        st.session_state.messages.append({"role": "assistant", "content": final_response})
