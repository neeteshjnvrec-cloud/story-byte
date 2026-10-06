# Approved deity reference portraits

Put one image per deity here, named by its key, and every daily devotional
scene showing that figure is generated to match it (face, complexion,
costume, ornaments). Without one, scenes still get the figure's traditional
iconography in the prompt (`scripts/lib/iconography.js`).

| Key | Figure | Key | Figure |
| --- | --- | --- | --- |
| `balkrishna` | Bal Krishna (child) | `krishna` | Krishna (adult) |
| `radha` | Radha | `yashoda` | Mother Yashoda |
| `shiva` | Lord Shiva | `parvati` | Goddess Parvati |
| `ganesha` | Lord Ganesha | `kartikeya` | Kartikeya |
| `hanuman` | Lord Hanuman | `ram` | Lord Ram |
| `sita` | Mother Sita | `lakshman` | Lakshman |
| `vishnu` | Lord Vishnu | `lakshmi` | Goddess Lakshmi |
| `durga` | Goddess Durga | `kali` | Goddess Kali |
| `saraswati` | Goddess Saraswati | `shani` | Shani Dev |
| `shailputri` … `siddhidatri` | The nine Navratri forms | | |

How to get them:

1. **Actions → Deity Portraits → Run workflow** (optionally list keys, e.g.
   `hanuman,shani`). It makes 2 candidates per deity from the traditional
   iconography; download them from the run's artifacts.
2. Pick the ones that look right, rename to `<key>.jpg` (e.g. `hanuman.jpg`)
   and add them to this folder (GitHub: **Add file → Upload files**).
3. Or use your own image — e.g. a still from one of your best murti Shorts.
   Any size; it's shrunk automatically. Use images you have the rights to.

Only the main figure of each image is used as a reference, so a clean,
front-facing, full-figure portrait works best.
