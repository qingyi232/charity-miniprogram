# -*- coding: utf-8 -*-
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.font_manager import FontProperties
import os

FONT = FontProperties(fname=r'C:\Windows\Fonts\simsun.ttc', size=11)
FONT_S = FontProperties(fname=r'C:\Windows\Fonts\simsun.ttc', size=9)
FONT_TITLE = FontProperties(fname=r'C:\Windows\Fonts\simsun.ttc', size=14)
OUT_DIR = r'f:\26dan\公益小程序\figures'
os.makedirs(OUT_DIR, exist_ok=True)

BOX_W = 2.4
BOX_H = 0.7
DIAMOND_S = 0.55
COL_GAP = 3.5
ROW_GAP = 1.3

def draw_box(ax, cx, cy, text, style='rect', w=BOX_W, h=BOX_H):
    """Draw a box (rect/rounded/diamond/ellipse) centered at (cx, cy)."""
    if style == 'rounded':
        rect = mpatches.FancyBboxPatch(
            (cx - w/2, cy - h/2), w, h,
            boxstyle='round,pad=0.08', facecolor='white',
            edgecolor='black', linewidth=1.2)
        ax.add_patch(rect)
    elif style == 'diamond':
        s = DIAMOND_S
        diamond = plt.Polygon(
            [(cx, cy + s), (cx + s*1.6, cy), (cx, cy - s), (cx - s*1.6, cy)],
            closed=True, facecolor='white', edgecolor='black', linewidth=1.2)
        ax.add_patch(diamond)
    elif style == 'ellipse':
        ell = mpatches.Ellipse((cx, cy), w, h, facecolor='white',
                                edgecolor='black', linewidth=1.2)
        ax.add_patch(ell)
    else:
        rect = mpatches.FancyBboxPatch(
            (cx - w/2, cy - h/2), w, h,
            boxstyle='square,pad=0', facecolor='white',
            edgecolor='black', linewidth=1.2)
        ax.add_patch(rect)
    ax.text(cx, cy, text, ha='center', va='center', fontproperties=FONT, fontsize=11)

def arrow_down(ax, x, y1, y2):
    ax.annotate('', xy=(x, y2 + 0.35), xytext=(x, y1 - 0.35),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

def arrow_right(ax, x1, y, x2):
    ax.annotate('', xy=(x2 - BOX_W/2, y), xytext=(x1 + BOX_W/2, y),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

def arrow_lr(ax, x1, y1, x2, y2, label=''):
    """Right-angle arrow: go right then down (or up)."""
    mid_x = x2
    ax.plot([x1 + BOX_W/2, mid_x], [y1, y1], 'k-', lw=1.2)
    ax.annotate('', xy=(mid_x, y2 + 0.35), xytext=(mid_x, y1),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))
    if label:
        ax.text((x1 + BOX_W/2 + mid_x)/2, y1 + 0.12, label,
                ha='center', va='bottom', fontproperties=FONT_S)

def arrow_diamond_down(ax, cx, cy, target_y):
    ax.annotate('', xy=(cx, target_y + 0.35), xytext=(cx, cy - DIAMOND_S),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

def arrow_diamond_right(ax, cx, cy, target_x, target_y, label=''):
    ax.plot([cx + DIAMOND_S*1.6, target_x - BOX_W/2], [cy, cy], 'k-', lw=1.2)
    if label:
        ax.text((cx + DIAMOND_S*1.6 + target_x - BOX_W/2)/2, cy + 0.12,
                label, ha='center', va='bottom', fontproperties=FONT_S)

def arrow_diamond_left(ax, cx, cy, target_x, target_y, label=''):
    ax.plot([cx - DIAMOND_S*1.6, target_x + BOX_W/2], [cy, cy], 'k-', lw=1.2)
    if label:
        ax.text((cx - DIAMOND_S*1.6 + target_x + BOX_W/2)/2, cy + 0.12,
                label, ha='center', va='bottom', fontproperties=FONT_S)

def label_arrow(ax, x, y1, y2, text, side='right'):
    mid_y = (y1 + y2) / 2
    offset = 0.1 if side == 'right' else -0.1
    ha = 'left' if side == 'right' else 'right'
    ax.text(x + offset, mid_y, text, ha=ha, va='center', fontproperties=FONT_S)

def setup_ax(fig, ax, title, xlim, ylim):
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_title(title, fontproperties=FONT_TITLE, pad=15)


# ========== 流程图1: 用户注册/登录流程 ==========
def draw_flow1():
    fig, ax = plt.subplots(1, 1, figsize=(10, 12))
    fig.patch.set_facecolor('white')

    cx = 5
    y0 = 11.0
    dy = ROW_GAP

    draw_box(ax, cx, y0, '开始', style='ellipse', w=1.8, h=0.6)
    y1 = y0 - dy
    draw_box(ax, cx, y1, '打开小程序')
    arrow_down(ax, cx, y0, y1)

    y2 = y1 - dy
    draw_box(ax, cx, y2, '选择身份\n（老人/志愿者）', style='diamond')
    arrow_down(ax, cx, y1, y2)

    y3_l = y2 - dy
    cx_l = cx - 2.5
    cx_r = cx + 2.5
    draw_box(ax, cx_l, y3_l, '老人端')
    draw_box(ax, cx_r, y3_l, '志愿者端')

    ax.plot([cx - DIAMOND_S*1.6, cx_l], [y2, y2], 'k-', lw=1.2)
    ax.annotate('', xy=(cx_l, y3_l + 0.35), xytext=(cx_l, y2),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))
    ax.text(cx - DIAMOND_S*1.6 - 0.2, y2 + 0.12, '老人',
            ha='right', va='bottom', fontproperties=FONT_S)

    ax.plot([cx + DIAMOND_S*1.6, cx_r], [y2, y2], 'k-', lw=1.2)
    ax.annotate('', xy=(cx_r, y3_l + 0.35), xytext=(cx_r, y2),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))
    ax.text(cx + DIAMOND_S*1.6 + 0.2, y2 + 0.12, '志愿者',
            ha='left', va='bottom', fontproperties=FONT_S)

    y4 = y3_l - dy
    draw_box(ax, cx, y4, '微信一键认证登录')
    ax.annotate('', xy=(cx - BOX_W/2 + 0.3, y4 + 0.35), xytext=(cx_l, y3_l - 0.35),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))
    ax.annotate('', xy=(cx + BOX_W/2 - 0.3, y4 + 0.35), xytext=(cx_r, y3_l - 0.35),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

    y5 = y4 - dy
    draw_box(ax, cx, y5, '后台审核', style='diamond')
    arrow_down(ax, cx, y4, y5)

    y6 = y5 - dy
    draw_box(ax, cx, y6, '进入对应首页')
    arrow_diamond_down(ax, cx, y5, y6)
    ax.text(cx + 0.1, (y5 - DIAMOND_S + y6 + 0.35)/2, '通过',
            ha='left', va='center', fontproperties=FONT_S)

    cx_fail = cx + COL_GAP
    draw_box(ax, cx_fail, y5, '审核不通过\n反馈提示')
    arrow_diamond_right(ax, cx, y5, cx_fail, y5, '不通过')

    ax.plot([cx_fail, cx_fail], [y5 - 0.35, y4], 'k-', lw=1.2)
    ax.annotate('', xy=(cx + BOX_W/2, y4), xytext=(cx_fail, y4),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))
    ax.text(cx_fail + 0.1, (y5 - 0.35 + y4)/2, '重新提交',
            ha='left', va='center', fontproperties=FONT_S)

    y7 = y6 - dy
    draw_box(ax, cx, y7, '结束', style='ellipse', w=1.8, h=0.6)
    arrow_down(ax, cx, y6, y7)

    setup_ax(fig, ax, '图4.1 用户注册/登录流程图', (0.5, 10.5), (y7 - 0.8, y0 + 0.8))
    fig.savefig(os.path.join(OUT_DIR, 'flow1_login.png'), dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('flow1_login.png done')


# ========== 流程图2: 帮扶订单流程 ==========
def draw_flow2():
    fig, ax = plt.subplots(1, 1, figsize=(12, 14))
    fig.patch.set_facecolor('white')

    cx = 5
    y = 13.0
    dy = ROW_GAP

    draw_box(ax, cx, y, '开始', style='ellipse', w=1.8, h=0.6)

    y -= dy
    draw_box(ax, cx, y, '老人选择需求分类')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '填写需求描述\n选择服务时间/地址')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '提交发布订单')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '系统生成帮扶订单')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '志愿者浏览订单列表')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '志愿者申请接单')
    arrow_down(ax, cx, y + dy, y)

    y_dec = y - dy
    draw_box(ax, cx, y_dec, '老人确认？', style='diamond')
    arrow_down(ax, cx, y, y_dec)

    y_yes = y_dec - dy
    draw_box(ax, cx, y_yes, '订单进行中\n志愿者上门服务')
    arrow_diamond_down(ax, cx, y_dec, y_yes)
    ax.text(cx + 0.1, (y_dec - DIAMOND_S + y_yes + 0.35)/2, '确认',
            ha='left', va='center', fontproperties=FONT_S)

    cx_no = cx + COL_GAP
    draw_box(ax, cx_no, y_dec, '订单回到\n待接单状态')
    arrow_diamond_right(ax, cx, y_dec, cx_no, y_dec, '拒绝')
    ax.plot([cx_no, cx_no], [y_dec + 0.35, y + dy - dy + 0.35 + dy], 'k-', lw=1.2)
    ax.annotate('', xy=(cx + BOX_W/2, y + dy - dy + 0.35 + dy),
                xytext=(cx_no, y + dy - dy + 0.35 + dy),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

    y_done = y_yes - dy
    draw_box(ax, cx, y_done, '服务完成')
    arrow_down(ax, cx, y_yes, y_done)

    y_eval = y_done - dy
    draw_box(ax, cx, y_eval, '双方评价')
    arrow_down(ax, cx, y_done, y_eval)

    y_end = y_eval - dy
    draw_box(ax, cx, y_end, '结束', style='ellipse', w=1.8, h=0.6)
    arrow_down(ax, cx, y_eval, y_end)

    setup_ax(fig, ax, '图4.2 帮扶订单流程图', (0.5, 11), (y_end - 0.8, 13.8))
    fig.savefig(os.path.join(OUT_DIR, 'flow2_order.png'), dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('flow2_order.png done')


# ========== 流程图3: 结对帮扶流程 ==========
def draw_flow3():
    fig, ax = plt.subplots(1, 1, figsize=(10, 13))
    fig.patch.set_facecolor('white')

    cx = 5
    y = 12.0
    dy = ROW_GAP

    draw_box(ax, cx, y, '开始', style='ellipse', w=1.8, h=0.6)

    y -= dy
    draw_box(ax, cx, y, '志愿者申请结对')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '选择帮扶老人')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '后台审核匹配', style='diamond')
    arrow_down(ax, cx, y + dy, y)

    y_pass = y - dy
    draw_box(ax, cx, y_pass, '结对绑定成功')
    arrow_diamond_down(ax, cx, y, y_pass)
    ax.text(cx + 0.1, (y - DIAMOND_S + y_pass + 0.35)/2, '通过',
            ha='left', va='center', fontproperties=FONT_S)

    cx_fail = cx + COL_GAP
    draw_box(ax, cx_fail, y, '审核不通过\n重新申请')
    arrow_diamond_right(ax, cx, y, cx_fail, y, '不通过')
    ax.plot([cx_fail, cx_fail], [y + 0.35, y + dy + dy], 'k-', lw=1.2)
    ax.annotate('', xy=(cx + BOX_W/2, y + dy + dy),
                xytext=(cx_fail, y + dy + dy),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

    y2 = y_pass - dy
    draw_box(ax, cx, y2, '双方互相查看信息')
    arrow_down(ax, cx, y_pass, y2)

    y3 = y2 - dy
    draw_box(ax, cx, y3, '志愿者上门服务\n打卡签到/签退')
    arrow_down(ax, cx, y2, y3)

    y4 = y3 - dy
    draw_box(ax, cx, y4, '服务时长自动累计')
    arrow_down(ax, cx, y3, y4)

    y5 = y4 - dy
    draw_box(ax, cx, y5, '生成公益服务档案')
    arrow_down(ax, cx, y4, y5)

    y6 = y5 - dy
    draw_box(ax, cx, y6, '结束', style='ellipse', w=1.8, h=0.6)
    arrow_down(ax, cx, y5, y6)

    setup_ax(fig, ax, '图4.3 结对帮扶流程图', (0.5, 10.5), (y6 - 0.8, 12.8))
    fig.savefig(os.path.join(OUT_DIR, 'flow3_pair.png'), dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('flow3_pair.png done')


# ========== 流程图4: 健康数据监测流程 ==========
def draw_flow4():
    fig, ax = plt.subplots(1, 1, figsize=(10, 13))
    fig.patch.set_facecolor('white')

    cx = 5
    y = 12.0
    dy = ROW_GAP

    draw_box(ax, cx, y, '开始', style='ellipse', w=1.8, h=0.6)

    y -= dy
    draw_box(ax, cx, y, '医疗设备采集数据\n（血压/心率/血氧/体温）')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '设备通过API接口\nHTTP POST上传')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '后端接收验证\n设备编号绑定老人')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '数据存入数据库\n时间戳记录')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '异常检测？', style='diamond')
    arrow_down(ax, cx, y + dy, y)

    y_normal = y - dy
    draw_box(ax, cx, y_normal, '前端拉取展示\n可视化曲线')
    arrow_diamond_down(ax, cx, y, y_normal)
    ax.text(cx + 0.1, (y - DIAMOND_S + y_normal + 0.35)/2, '正常',
            ha='left', va='center', fontproperties=FONT_S)

    cx_warn = cx + COL_GAP
    draw_box(ax, cx_warn, y, '触发异常预警')
    arrow_diamond_right(ax, cx, y, cx_warn, y, '异常')

    y_push = y - dy
    draw_box(ax, cx_warn, y_push, '推送志愿者\n+后台管理员')
    arrow_down(ax, cx_warn, y, y_push)

    ax.plot([cx_warn, cx_warn], [y_push - 0.35, y_normal - 0.35 - 0.3], 'k-', lw=1.2)
    ax.plot([cx_warn, cx + BOX_W/2], [y_normal - 0.35 - 0.3, y_normal - 0.35 - 0.3], 'k-', lw=1.2)
    ax.annotate('', xy=(cx, y_normal - 0.35 - 0.3 - 0.05), xytext=(cx, y_normal - 0.35 - 0.3 + 0.05),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

    y_end_val = y_normal - dy
    draw_box(ax, cx, y_end_val, '自动刷新\n持续监测')
    arrow_down(ax, cx, y_normal, y_end_val)

    y_end = y_end_val - dy
    draw_box(ax, cx, y_end, '结束', style='ellipse', w=1.8, h=0.6)
    arrow_down(ax, cx, y_end_val, y_end)

    setup_ax(fig, ax, '图4.4 健康数据监测流程图', (0.5, 10.5), (y_end - 0.8, 12.8))
    fig.savefig(os.path.join(OUT_DIR, 'flow4_health.png'), dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('flow4_health.png done')


# ========== 流程图5: 紧急求助流程 ==========
def draw_flow5():
    fig, ax = plt.subplots(1, 1, figsize=(10, 12))
    fig.patch.set_facecolor('white')

    cx = 5
    y = 11.0
    dy = ROW_GAP

    draw_box(ax, cx, y, '开始', style='ellipse', w=1.8, h=0.6)

    y -= dy
    draw_box(ax, cx, y, '老人按下\n「一键紧急呼救」')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '系统获取当前位置\n+健康异常数据')
    arrow_down(ax, cx, y + dy, y)

    y -= dy
    draw_box(ax, cx, y, '有结对志愿者？', style='diamond')
    arrow_down(ax, cx, y + dy, y)

    y_yes = y - dy
    cx_l = cx - 2.2
    cx_r = cx + 2.2
    draw_box(ax, cx_l, y_yes, '推送结对志愿者')
    draw_box(ax, cx_r, y_yes, '推送后台管理员')

    ax.plot([cx - DIAMOND_S*1.6, cx_l], [y, y], 'k-', lw=1.2)
    ax.annotate('', xy=(cx_l, y_yes + 0.35), xytext=(cx_l, y),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))
    ax.text(cx - DIAMOND_S*1.6 - 0.15, y + 0.12, '有',
            ha='right', va='bottom', fontproperties=FONT_S)

    ax.plot([cx + DIAMOND_S*1.6, cx_r], [y, y], 'k-', lw=1.2)
    ax.annotate('', xy=(cx_r, y_yes + 0.35), xytext=(cx_r, y),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))
    ax.text(cx + DIAMOND_S*1.6 + 0.15, y + 0.12, '无',
            ha='left', va='bottom', fontproperties=FONT_S)

    y_sms = y_yes - dy
    draw_box(ax, cx, y_sms, '短信通知紧急联系人')
    ax.annotate('', xy=(cx - BOX_W/2 + 0.3, y_sms + 0.35), xytext=(cx_l, y_yes - 0.35),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))
    ax.annotate('', xy=(cx + BOX_W/2 - 0.3, y_sms + 0.35), xytext=(cx_r, y_yes - 0.35),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.2))

    y_resp = y_sms - dy
    draw_box(ax, cx, y_resp, '志愿者/管理员\n响应处理')
    arrow_down(ax, cx, y_sms, y_resp)

    y_record = y_resp - dy
    draw_box(ax, cx, y_record, '记录求助事件')
    arrow_down(ax, cx, y_resp, y_record)

    y_end = y_record - dy
    draw_box(ax, cx, y_end, '结束', style='ellipse', w=1.8, h=0.6)
    arrow_down(ax, cx, y_record, y_end)

    setup_ax(fig, ax, '图4.5 紧急求助流程图', (0.5, 10), (y_end - 0.8, y + dy + dy + dy + 0.8))
    fig.savefig(os.path.join(OUT_DIR, 'flow5_emergency.png'), dpi=200, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('flow5_emergency.png done')


if __name__ == '__main__':
    draw_flow1()
    draw_flow2()
    draw_flow3()
    draw_flow4()
    draw_flow5()
    print('All 5 flowcharts generated in', OUT_DIR)
