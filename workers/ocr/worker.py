from datetime import datetime
import os
from pathlib import Path
import shutil
import time

import pytesseract
from PIL import Image
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer


INPUT_PATH = Path(os.getenv("OCR_INPUT_PATH", "/data/inbox"))
PROCESSED_PATH = Path(os.getenv("OCR_PROCESSED_PATH", "/data/processed"))
FAILED_PATH = Path(os.getenv("OCR_FAILED_PATH", "/data/failed"))
OUTPUT_PATH = Path(os.getenv("OCR_OUTPUT_PATH", "/data/output"))
OCR_LANGUAGES = os.getenv("OCR_LANGUAGES", "deu+eng")
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}


def ensure_directories() -> None:
    for path in (INPUT_PATH, PROCESSED_PATH, FAILED_PATH, OUTPUT_PATH):
        path.mkdir(parents=True, exist_ok=True)


def wait_until_file_is_ready(path: Path, timeout_seconds: int = 10) -> bool:
    previous_size = -1
    for _ in range(timeout_seconds * 2):
        if path.exists():
            current_size = path.stat().st_size
            if current_size == previous_size and current_size > 0:
                return True
            previous_size = current_size
        time.sleep(0.5)
    return False


def create_output_markdown(image_path: Path, text: str) -> str:
    captured_at = datetime.now().isoformat(timespec="seconds")
    return f"""---
source_type: tiktok_photo_post
source_file: "{image_path.name}"
captured_at: "{captured_at}"
ocr_engine: tesseract
ocr_languages: "{OCR_LANGUAGES}"
ocr_status: done
review_status: inbox
---

# OCR: {image_path.stem}

## Extracted Text

{text.strip()}

## Notes

## Review

- [ ] Keep
- [ ] Refine
- [ ] Archive
"""


def move_unique(source: Path, target_dir: Path) -> None:
    target = target_dir / source.name
    if target.exists():
        target = target_dir / f"{source.stem}-{int(time.time())}{source.suffix}"
    shutil.move(str(source), str(target))


def process_image(image_path: Path) -> None:
    if image_path.suffix.lower() not in IMAGE_EXTENSIONS:
        return
    if not wait_until_file_is_ready(image_path):
        raise RuntimeError(f"File was not ready: {image_path}")

    text = pytesseract.image_to_string(Image.open(image_path), lang=OCR_LANGUAGES)
    (OUTPUT_PATH / f"{image_path.stem}.md").write_text(create_output_markdown(image_path, text), encoding="utf-8")
    move_unique(image_path, PROCESSED_PATH)
    print(f"Done: {image_path.name}", flush=True)


def process_file(file_path: Path) -> None:
    try:
        process_image(file_path)
    except Exception as error:
        print(f"Failed {file_path.name}: {error}", flush=True)
        if file_path.exists():
            move_unique(file_path, FAILED_PATH)


class OcrInboxHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            process_file(Path(event.src_path))


if __name__ == "__main__":
    ensure_directories()
    for file_path in INPUT_PATH.iterdir():
        if file_path.is_file():
            process_file(file_path)

    observer = Observer()
    observer.schedule(OcrInboxHandler(), str(INPUT_PATH), recursive=False)
    observer.start()
    print(f"Watching OCR inbox: {INPUT_PATH}", flush=True)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
