import math
import os
from PIL import Image, ImageDraw

def create_app_icon():
    os.makedirs('build', exist_ok=True)
    os.makedirs('public', exist_ok=True)

    # Work at 1024x1024 supersampled resolution for ultra crisp vector-like edges
    S = 1024
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Draw rounded rectangle (Squircle) with Red gradient
    # Margins: 60px on each side
    pad = 60
    r = 220 # Corner radius
    
    # Create mask for rounded rect
    mask = Image.new('L', (S, S), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([pad, pad, S - pad, S - pad], radius=r, fill=255)

    # Create vibrant Red Gradient
    gradient = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(gradient)
    top_color = (239, 68, 68)     # Vibrant Red (#ef4444)
    bottom_color = (185, 28, 28)  # Deep Crimson Red (#b91c1c)

    for y in range(pad, S - pad):
        factor = (y - pad) / float(S - 2 * pad)
        r_c = int(top_color[0] + factor * (bottom_color[0] - top_color[0]))
        g_c = int(top_color[1] + factor * (bottom_color[1] - top_color[1]))
        b_c = int(top_color[2] + factor * (bottom_color[2] - top_color[2]))
        g_draw.line([(pad, y), (S - pad, y)], fill=(r_c, g_c, b_c, 255))

    # Apply mask to gradient
    tile = Image.composite(gradient, img, mask)
    draw_tile = ImageDraw.Draw(tile)

    # 2. Draw crisp White Zig-zag Arrow
    # Zig-zag path vertices (normalized relative to bounding box)
    # Start bottom-left, up, down, up, arrow head pointing up-right
    pts = [
        (300, 680),  # Start bottom left
        (460, 470),  # 1st peak
        (560, 580),  # Trough
        (720, 390),  # Stem meets arrowhead
    ]

    stroke_w = 72

    # Draw thick lines with round joints
    for i in range(len(pts) - 1):
        draw_tile.line([pts[i], pts[i+1]], fill=(255, 255, 255, 255), width=stroke_w)
        # Cap
        draw_tile.ellipse([pts[i][0] - stroke_w/2, pts[i][1] - stroke_w/2, 
                           pts[i][0] + stroke_w/2, pts[i][1] + stroke_w/2], fill=(255, 255, 255, 255))
    
    # Arrow head at the top right
    # Arrow tip at (790, 310), base corners
    tip = (805, 305)
    left_wing = (620, 320)
    right_wing = (790, 490)
    inner_base = (705, 405)

    draw_tile.polygon([tip, left_wing, inner_base, right_wing], fill=(255, 255, 255, 255))

    # Final downsample with Lanczos for perfect anti-aliasing
    final_512 = tile.resize((512, 512), Image.Resampling.LANCZOS)
    final_256 = tile.resize((256, 256), Image.Resampling.LANCZOS)
    final_128 = tile.resize((128, 128), Image.Resampling.LANCZOS)
    final_64 = tile.resize((64, 64), Image.Resampling.LANCZOS)
    final_48 = tile.resize((48, 48), Image.Resampling.LANCZOS)
    final_32 = tile.resize((32, 32), Image.Resampling.LANCZOS)
    final_16 = tile.resize((16, 16), Image.Resampling.LANCZOS)

    # Save PNG files
    final_512.save('build/icon.png', 'PNG')
    final_512.save('public/icon.png', 'PNG')
    final_32.save('public/favicon.png', 'PNG')

    # Save multi-resolution Windows ICO file
    final_256.save(
        'build/icon.ico', 
        format='ICO', 
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    )
    final_256.save(
        'public/favicon.ico', 
        format='ICO', 
        sizes=[(64, 64), (32, 32), (16, 16)]
    )

    print('Successfully generated build/icon.ico, build/icon.png, public/icon.png, public/favicon.ico!')

if __name__ == '__main__':
    create_app_icon()
