#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
塔罗牌完整牌组下载脚本
使用Pixabay API搜索并下载完整的78张塔罗牌牌面
"""

import requests
import os
import time
from pathlib import Path

# Pixabay API配置
API_KEY = "54443804-0610c3c43afe04c059af253e3"
BASE_URL = "https://pixabay.com/api/"

# 下载配置
DOWNLOAD_DIR = "tarot_cards"

# 完整的78张塔罗牌搜索关键词
TAROT_CARDS = {
    "大阿卡纳 (Major Arcana)": [
        ("The Fool tarot card", "00_愚者_The_Fool"),
        ("The Magician tarot card", "01_魔术师_The_Magician"),
        ("The High Priestess tarot card", "02_女祭司_The_High_Priestess"),
        ("The Empress tarot card", "03_皇后_The_Empress"),
        ("The Emperor tarot card", "04_皇帝_The_Emperor"),
        ("The Hierophant tarot card", "05_教皇_The_Hierophant"),
        ("The Lovers tarot card", "06_恋人_The_Lovers"),
        ("The Chariot tarot card", "07_战车_The_Chariot"),
        ("Strength tarot card", "08_力量_Strength"),
        ("The Hermit tarot card", "09_隐士_The_Hermit"),
        ("Wheel of Fortune tarot card", "10_命运之轮_Wheel_of_Fortune"),
        ("Justice tarot card", "11_正义_Justice"),
        ("The Hanged Man tarot card", "12_倒吊人_The_Hanged_Man"),
        ("Death tarot card", "13_死神_Death"),
        ("Temperance tarot card", "14_节制_Temperance"),
        ("The Devil tarot card", "15_恶魔_The_Devil"),
        ("The Tower tarot card", "16_高塔_The_Tower"),
        ("The Star tarot card", "17_星星_The_Star"),
        ("The Moon tarot card", "18_月亮_The_Moon"),
        ("The Sun tarot card", "19_太阳_The_Sun"),
        ("Judgement tarot card", "20_审判_Judgement"),
        ("The World tarot card", "21_世界_The_World")
    ],
    "权杖 (Wands)": [
        ("Ace of Wands tarot", "wands_01_权杖王牌"),
        ("Two of Wands tarot", "wands_02_权杖二"),
        ("Three of Wands tarot", "wands_03_权杖三"),
        ("Four of Wands tarot", "wands_04_权杖四"),
        ("Five of Wands tarot", "wands_05_权杖五"),
        ("Six of Wands tarot", "wands_06_权杖六"),
        ("Seven of Wands tarot", "wands_07_权杖七"),
        ("Eight of Wands tarot", "wands_08_权杖八"),
        ("Nine of Wands tarot", "wands_09_权杖九"),
        ("Ten of Wands tarot", "wands_10_权杖十"),
        ("Page of Wands tarot", "wands_11_权杖侍从"),
        ("Knight of Wands tarot", "wands_12_权杖骑士"),
        ("Queen of Wands tarot", "wands_13_权杖王后"),
        ("King of Wands tarot", "wands_14_权杖国王")
    ],
    "圣杯 (Cups)": [
        ("Ace of Cups tarot", "cups_01_圣杯王牌"),
        ("Two of Cups tarot", "cups_02_圣杯二"),
        ("Three of Cups tarot", "cups_03_圣杯三"),
        ("Four of Cups tarot", "cups_04_圣杯四"),
        ("Five of Cups tarot", "cups_05_圣杯五"),
        ("Six of Cups tarot", "cups_06_圣杯六"),
        ("Seven of Cups tarot", "cups_07_圣杯七"),
        ("Eight of Cups tarot", "cups_08_圣杯八"),
        ("Nine of Cups tarot", "cups_09_圣杯九"),
        ("Ten of Cups tarot", "cups_10_圣杯十"),
        ("Page of Cups tarot", "cups_11_圣杯侍从"),
        ("Knight of Cups tarot", "cups_12_圣杯骑士"),
        ("Queen of Cups tarot", "cups_13_圣杯王后"),
        ("King of Cups tarot", "cups_14_圣杯国王")
    ],
    "宝剑 (Swords)": [
        ("Ace of Swords tarot", "swords_01_宝剑王牌"),
        ("Two of Swords tarot", "swords_02_宝剑二"),
        ("Three of Swords tarot", "swords_03_宝剑三"),
        ("Four of Swords tarot", "swords_04_宝剑四"),
        ("Five of Swords tarot", "swords_05_宝剑五"),
        ("Six of Swords tarot", "swords_06_宝剑六"),
        ("Seven of Swords tarot", "swords_07_宝剑七"),
        ("Eight of Swords tarot", "swords_08_宝剑八"),
        ("Nine of Swords tarot", "swords_09_宝剑九"),
        ("Ten of Swords tarot", "swords_10_宝剑十"),
        ("Page of Swords tarot", "swords_11_宝剑侍从"),
        ("Knight of Swords tarot", "swords_12_宝剑骑士"),
        ("Queen of Swords tarot", "swords_13_宝剑王后"),
        ("King of Swords tarot", "swords_14_宝剑国王")
    ],
    "星币 (Pentacles)": [
        ("Ace of Pentacles tarot", "pents_01_星币王牌"),
        ("Two of Pentacles tarot", "pents_02_星币二"),
        ("Three of Pentacles tarot", "pents_03_星币三"),
        ("Four of Pentacles tarot", "pents_04_星币四"),
        ("Five of Pentacles tarot", "pents_05_星币五"),
        ("Six of Pentacles tarot", "pents_06_星币六"),
        ("Seven of Pentacles tarot", "pents_07_星币七"),
        ("Eight of Pentacles tarot", "pents_08_星币八"),
        ("Nine of Pentacles tarot", "pents_09_星币九"),
        ("Ten of Pentacles tarot", "pents_10_星币十"),
        ("Page of Pentacles tarot", "pents_11_星币侍从"),
        ("Knight of Pentacles tarot", "pents_12_星币骑士"),
        ("Queen of Pentacles tarot", "pents_13_星币王后"),
        ("King of Pentacles tarot", "pents_14_星币国王")
    ]
}

def create_download_dir():
    """创建下载目录"""
    Path(DOWNLOAD_DIR).mkdir(parents=True, exist_ok=True)
    print(f"✓ 下载目录已创建: {DOWNLOAD_DIR}")

def search_card_image(query):
    """
    搜索特定塔罗牌图片
    
    参数:
        query: 搜索关键词
    """
    params = {
        "key": API_KEY,
        "q": query,
        "image_type": "all",
        "min_width": 800,
        "min_height": 1200,
        "per_page": 3,
        "safesearch": "true"
    }
    
    try:
        response = requests.get(BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data and "hits" in data and len(data["hits"]) > 0:
            # 返回第一个结果的高清图片URL
            hit = data["hits"][0]
            return hit.get("largeImageURL") or hit.get("webformatURL")
        return None
    except requests.exceptions.RequestException as e:
        print(f"  ✗ 搜索失败: {e}")
        return None

def download_image(url, filename):
    """
    下载单张图片
    
    参数:
        url: 图片URL
        filename: 保存的文件名
    """
    try:
        response = requests.get(url, timeout=30, stream=True)
        response.raise_for_status()
        
        filepath = os.path.join(DOWNLOAD_DIR, filename + ".jpg")
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return True
    except requests.exceptions.RequestException as e:
        print(f"  ✗ 下载失败: {e}")
        return False

def main():
    """主函数"""
    print("=" * 70)
    print("塔罗牌完整牌组下载器 - 使用Pixabay搜索")
    print("=" * 70)
    print("\n📋 将搜索并下载完整的78张塔罗牌：")
    print("   • 22张大阿卡纳 (Major Arcana)")
    print("   • 56张小阿卡纳 (Minor Arcana)")
    print("     - 14张权杖 (Wands)")
    print("     - 14张圣杯 (Cups)")
    print("     - 14张宝剑 (Swords)")
    print("     - 14张星币 (Pentacles)")
    print("\n⏱ 注意：由于需要逐张搜索，整个过程可能需要几分钟...")
    print()
    
    # 创建下载目录
    create_download_dir()
    
    # 开始下载
    total_cards = sum(len(cards) for cards in TAROT_CARDS.values())
    downloaded_count = 0
    failed_cards = []
    
    print(f"\n开始搜索并下载 {total_cards} 张塔罗牌...\n")
    
    for category, cards in TAROT_CARDS.items():
        print(f"\n{'='*70}")
        print(f"📂 {category} ({len(cards)}张)")
        print('='*70)
        
        for search_query, filename in cards:
            downloaded_count += 1
            print(f"[{downloaded_count}/{total_cards}] {filename}...", end=" ")
            
            # 搜索图片
            image_url = search_card_image(search_query)
            
            if image_url:
                # 下载图片
                if download_image(image_url, filename):
                    print("✓")
                else:
                    print("✗ 下载失败")
                    failed_cards.append(filename)
            else:
                print("✗ 未找到")
                failed_cards.append(filename)
            
            # 避免API请求过快
            time.sleep(1)
    
    # 显示结果
    print("\n" + "=" * 70)
    print("📊 下载完成统计")
    print("=" * 70)
    print(f"✓ 成功下载: {total_cards - len(failed_cards)} 张")
    print(f"✗ 下载失败: {len(failed_cards)} 张")
    print(f"📁 保存位置: {os.path.abspath(DOWNLOAD_DIR)}")
    
    if failed_cards:
        print(f"\n⚠ 失败的卡牌数量: {len(failed_cards)}")
        print("\n💡 提示：可以重新运行脚本下载失败的卡牌")
    else:
        print("\n🎉 所有塔罗牌下载成功！")
    
    print("=" * 70)

if __name__ == "__main__":
    main()
