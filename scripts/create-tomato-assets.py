from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math


ROOT = Path(__file__).resolve().parents[1]
SPRITE_DIR = ROOT / "public" / "assets" / "pets" / "tomato" / "sprites"
TRAY_DIR = ROOT / "public" / "assets" / "tray"


def ellipse(draw: ImageDraw.ImageDraw, box, fill, outline=None, width=1):
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def line(draw: ImageDraw.ImageDraw, points, fill, width=1):
    draw.line(points, fill=fill, width=width, joint="curve")


def leaf(draw: ImageDraw.ImageDraw, cx, cy, angle, scale=1.0):
    length = 56 * scale
    width = 18 * scale
    points = []
    for i in range(18):
        t = i / 17
        a = angle + (t - 0.5) * 0.9
        r = math.sin(t * math.pi) * width
        x = cx + math.cos(angle) * length * t + math.cos(a + math.pi / 2) * r
        y = cy + math.sin(angle) * length * t + math.sin(a + math.pi / 2) * r
        points.append((x, y))
    for i in range(17, -1, -1):
        t = i / 17
        a = angle - (t - 0.5) * 0.9
        r = math.sin(t * math.pi) * width
        x = cx + math.cos(angle) * length * t - math.cos(a + math.pi / 2) * r
        y = cy + math.sin(angle) * length * t - math.sin(a + math.pi / 2) * r
        points.append((x, y))
    draw.polygon(points, fill=(86, 176, 58, 255), outline=(39, 91, 37, 255))


def draw_body(draw: ImageDraw.ImageDraw, cx, base_y, pose):
    body = (245, 238, 218, 255)
    outline = (92, 35, 31, 255)
    ellipse(draw, (cx - 54, base_y - 118, cx + 54, base_y + 26), body, outline, 6)
    if pose == "playing":
        line(draw, [(cx - 40, base_y - 72), (cx - 112, base_y - 132)], outline, 12)
        ellipse(draw, (cx - 126, base_y - 145, cx - 96, base_y - 115), (224, 51, 35, 255), outline, 5)
        line(draw, [(cx + 40, base_y - 70), (cx + 92, base_y - 92)], outline, 12)
        ellipse(draw, (cx + 82, base_y - 106, cx + 112, base_y - 76), (224, 51, 35, 255), outline, 5)
        ellipse(draw, (cx - 118, base_y - 96, cx - 70, base_y - 48), (225, 52, 36, 255), outline, 5)
        line(draw, [(cx - 94, base_y - 74), (cx - 94, base_y - 18)], (245, 245, 235, 255), 4)
    else:
        line(draw, [(cx - 40, base_y - 70), (cx - 88, base_y - 38)], outline, 12)
        line(draw, [(cx + 40, base_y - 70), (cx + 88, base_y - 38)], outline, 12)
        ellipse(draw, (cx - 102, base_y - 52, cx - 72, base_y - 22), (224, 51, 35, 255), outline, 5)
        ellipse(draw, (cx + 72, base_y - 52, cx + 102, base_y - 22), (224, 51, 35, 255), outline, 5)
    ellipse(draw, (cx - 64, base_y - 4, cx - 18, base_y + 42), (224, 51, 35, 255), outline, 5)
    ellipse(draw, (cx + 18, base_y - 4, cx + 64, base_y + 42), (224, 51, 35, 255), outline, 5)


def draw_head(draw: ImageDraw.ImageDraw, cx, cy, pose):
    outline = (92, 35, 31, 255)
    ellipse(draw, (cx - 126, cy - 106, cx + 126, cy + 96), (232, 60, 41, 255), outline, 8)
    ellipse(draw, (cx - 102, cy - 82, cx + 80, cy + 76), (255, 84, 48, 255), None, 1)
    ellipse(draw, (cx - 74, cy - 70, cx - 38, cy - 42), (255, 238, 196, 225), None, 1)
    ellipse(draw, (cx + 68, cy - 50, cx + 94, cy - 24), (255, 238, 196, 210), None, 1)
    ellipse(draw, (cx - 92, cy + 22, cx - 54, cy + 52), (255, 128, 112, 170), None, 1)
    ellipse(draw, (cx + 56, cy + 22, cx + 94, cy + 52), (255, 128, 112, 170), None, 1)
    for angle in [-2.6, -2.05, -1.55, -1.1, -0.55]:
        leaf(draw, cx, cy - 102, angle, 1.05)
    ellipse(draw, (cx - 12, cy - 156, cx + 12, cy - 98), (83, 166, 58, 255), outline, 4)


def draw_face(draw: ImageDraw.ImageDraw, cx, cy, pose):
    outline = (51, 24, 24, 255)
    if pose == "sleeping":
        line(draw, [(cx - 58, cy + 8), (cx - 32, cy + 20), (cx - 12, cy + 4)], outline, 7)
        line(draw, [(cx + 28, cy + 8), (cx + 54, cy + 20), (cx + 74, cy + 4)], outline, 7)
        line(draw, [(cx - 16, cy + 54), (cx + 26, cy + 50)], outline, 8)
        ellipse(draw, (cx + 52, cy + 48, cx + 66, cy + 66), (255, 245, 235, 230), None, 1)
    elif pose == "working":
        for ox in [-45, 45]:
            ellipse(draw, (cx + ox - 28, cy - 16, cx + ox + 28, cy + 40), (255, 235, 222, 80), outline, 6)
            ellipse(draw, (cx + ox - 12, cy + 0, cx + ox + 12, cy + 28), (60, 38, 34, 255), None, 1)
            ellipse(draw, (cx + ox - 5, cy + 4, cx + ox + 3, cy + 12), (255, 255, 245, 255), None, 1)
        line(draw, [(cx - 17, cy + 10), (cx + 17, cy + 10)], outline, 5)
        line(draw, [(cx - 66, cy - 28), (cx - 38, cy - 18)], outline, 7)
        line(draw, [(cx + 38, cy - 18), (cx + 66, cy - 28)], outline, 7)
        line(draw, [(cx - 22, cy + 62), (cx, cy + 72), (cx + 22, cy + 62)], outline, 5)
    else:
        ellipse(draw, (cx - 64, cy - 4, cx - 32, cy + 36), (60, 38, 34, 255), None, 1)
        ellipse(draw, (cx - 55, cy + 2, cx - 45, cy + 14), (255, 255, 245, 255), None, 1)
        line(draw, [(cx + 28, cy + 8), (cx + 56, cy + 20), (cx + 78, cy + 4)], outline, 7)
        pieslice_box = (cx - 10, cy + 42, cx + 58, cy + 92)
        draw.pieslice(pieslice_box, 0, 180, fill=(255, 114, 112, 255), outline=outline, width=6)


def draw_accessory(draw: ImageDraw.ImageDraw, cx, cy, pose, variant=0):
    outline = (92, 35, 31, 255)
    if pose == "sleeping":
        draw.rounded_rectangle((cx - 138, cy + 62, cx + 72, cy + 142), radius=30, fill=(71, 132, 216, 255), outline=outline, width=6)
        draw.polygon([(cx - 118, cy + 142), (cx + 8, cy + 142), (cx + 60, cy + 106), (cx - 88, cy + 100)], fill=(90, 151, 235, 255))
        draw.polygon([(cx - 82, cy + 96), (cx - 70, cy + 122), (cx - 42, cy + 124), (cx - 64, cy + 138), (cx - 54, cy + 164), (cx - 82, cy + 148), (cx - 108, cy + 164), (cx - 98, cy + 138), (cx - 120, cy + 124), (cx - 92, cy + 122)], fill=(255, 218, 84, 255))
    elif pose == "working":
        draw.rounded_rectangle((cx + 12, cy + 82, cx + 108, cy + 154), radius=10, fill=(44, 92, 64, 255), outline=outline, width=5)
        for x in range(cx + 20, cx + 106, 18):
            line(draw, [(x, cy + 86), (x, cy + 150)], (238, 198, 76, 255), 4)
        line(draw, [(cx - 84, cy + 86), (cx - 120, cy + 42)], (238, 190, 54, 255), 12)
        line(draw, [(cx - 122, cy + 40), (cx - 134, cy + 28)], outline, 5)
    else:
        yoyo_offset = -42 if variant else 0
        ellipse(draw, (cx - 120, cy + 98 + yoyo_offset, cx - 54, cy + 164 + yoyo_offset), (229, 53, 36, 255), outline, 6)
        ellipse(draw, (cx - 98, cy + 118 + yoyo_offset, cx - 76, cy + 140 + yoyo_offset), (255, 216, 84, 255), None, 1)
        line(draw, [(cx - 87, cy + 98 + yoyo_offset), (cx - 100, cy + 38)], (245, 245, 235, 255), 4)


def draw_sprite(pose: str, variant=0, size=512):
    scale = 1
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    cx = size // 2
    cy = 182
    base_y = 344
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.ellipse((cx - 120, base_y + 18, cx + 120, base_y + 58), fill=(70, 38, 28, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    canvas.alpha_composite(shadow)

    if pose == "playing":
        base_y -= 12
        cy -= 10
    if pose == "sleeping":
        cy += 10
        base_y += 14
    if variant and pose != "playing":
        cy -= 3

    draw_body(draw, cx, base_y, pose)
    draw_head(draw, cx, cy, pose)
    draw_face(draw, cx, cy, pose)
    draw_accessory(draw, cx, cy, pose, variant)
    return canvas


def make_sheet():
    SPRITE_DIR.mkdir(parents=True, exist_ok=True)
    frames = [(pose, variant) for pose in ["sleeping", "working", "playing"] for variant in [0, 1]]
    sheet = Image.new("RGBA", (512 * len(frames), 512), (0, 0, 0, 0))
    for index, (pose, variant) in enumerate(frames):
        sprite = draw_sprite(pose, variant)
        sprite.save(SPRITE_DIR / f"{pose}-{variant}.png")
        if variant == 0:
            sprite.save(SPRITE_DIR / f"{pose}.png")
        sheet.alpha_composite(sprite, (index * 512, 0))
    sheet.save(SPRITE_DIR / "tomato-sprite-sheet.png")


def make_tray():
    TRAY_DIR.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    ellipse(draw, (10, 16, 54, 56), (232, 60, 41, 255), (92, 35, 31, 255), 3)
    draw.polygon([(32, 18), (20, 8), (31, 12), (36, 3), (40, 14), (52, 10), (43, 20)], fill=(86, 176, 58, 255), outline=(39, 91, 37, 255))
    ellipse(draw, (22, 34, 26, 39), (51, 24, 24, 255))
    ellipse(draw, (38, 34, 42, 39), (51, 24, 24, 255))
    line(draw, [(26, 47), (32, 50), (38, 47)], (51, 24, 24, 255), 2)
    image.save(TRAY_DIR / "tomato-tray.png")


if __name__ == "__main__":
    make_sheet()
    make_tray()
