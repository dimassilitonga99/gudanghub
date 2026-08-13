from PIL import Image
src = Image.open('public/android-chrome-512x512.png').convert('RGBA')
sizes = [72, 96, 128, 144, 152, 192, 384, 512]
bg = (255, 107, 0, 255)  # #ff6b00
for s in sizes:
    canvas = Image.new('RGBA', (s, s), bg)
    inner = max(1, int(s * 0.8))
    logo = src.resize((inner, inner), Image.LANCZOS)
    off = (s - inner) // 2
    canvas.paste(logo, (off, off), logo)
    canvas.save(f'public/icons/icon-{s}.png', optimize=True)
    print('wrote', f'public/icons/icon-{s}.png')
