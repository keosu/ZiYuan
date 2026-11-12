# 生成 js/extra.js：任一古文字字体收录的汉字，并记下每个字有哪些阶段、常用程度
# 用法：python tools/gen-extra.py   （需要 fontTools、pypinyin、jieba）
# k 是位掩码：甲骨文 1、金文 2、小篆 4。没有的阶段不显示。
# HAN_RANK 按 jieba 词典的字频从高到低排列，用来划分「识丁 / 千文 / 通文…」各卷。
import collections
import json
import os
import re

import jieba
from fontTools.ttLib import TTFont
from pypinyin import Style, pinyin

FONTS = {
    "oracle": "assets/fonts/Chine-Culture-Jiaguwen.woff2",
    "bronze": "assets/fonts/Chine-Culture-Jinwen.woff2",
    "seal": "assets/fonts/Chine-Culture-Xiaozhuan.woff2",
}
BIT = {"oracle": 1, "bronze": 2, "seal": 4}


def cjk(font_path):
    cmap = TTFont(font_path).getBestCmap()
    return {chr(cp) for cp in cmap if 0x4E00 <= cp <= 0x9FFF}


sets = {name: cjk(path) for name, path in FONTS.items()}
union = set.union(*sets.values())
curated = set(re.findall(r'\bc:\s*"([^"]+)"', open("js/data.js", encoding="utf-8").read()))


def mask(ch):
    return sum(bit for name, bit in BIT.items() if ch in sets[name])


def reading(ch):
    return pinyin(ch, style=Style.TONE)[0][0]


def sort_key(ch):
    return pinyin(ch, style=Style.NORMAL)[0][0]


def in_gb2312(ch):
    try:
        ch.encode("gb2312")
        return True
    except UnicodeEncodeError:
        return False


# jieba 词典里混有乱码词条，只用全由 GB2312 字组成的词排主序，其余词频只用来排后面的字
freq = collections.Counter()
clean = collections.Counter()
with open(os.path.join(os.path.dirname(jieba.__file__), "dict.txt"), encoding="utf-8") as f:
    for line in f:
        word, n = line.split()[:2]
        ok = all(in_gb2312(ch) for ch in word)
        for ch in word:
            freq[ch] += int(n)
            if ok:
                clean[ch] += int(n)

library = union | curated
masks = {ch: mask(ch) for ch in library}
extra = [ch for ch in union if ch not in curated]
extra.sort(key=sort_key)
rank = sorted(library, key=lambda ch: (-clean[ch], -freq[ch], ord(ch)))

with open("js/extra.js", "w", encoding="utf-8") as out:
    out.write("// 自动生成：python tools/gen-extra.py\n")
    out.write("// HAN_MASK：甲骨文 1、金文 2、小篆 4，可叠加。0 表示三套古文字体都没有。\n")
    out.write("window.HAN_MASK = " + json.dumps(masks, ensure_ascii=False, separators=(",", ":")) + ";\n")
    out.write("window.HAN_EXTRA = " + json.dumps(
        [{"c": ch, "py": reading(ch)} for ch in extra], ensure_ascii=False, separators=(",", ":")) + ";\n")
    out.write("// HAN_RANK：全部字按常用程度排序\n")
    out.write("window.HAN_RANK = " + json.dumps("".join(rank), ensure_ascii=False) + ";\n")

only = {name: sum(1 for ch in union if mask(ch) == bit) for name, bit in BIT.items()}
print(f"union {len(union)} curated {len(curated & union)} extra {len(extra)}")
print("only", only, "all-three", sum(1 for ch in union if mask(ch) == 7))
print("with frequency", sum(1 for ch in library if freq[ch]), "clean", sum(1 for ch in library if clean[ch]))
