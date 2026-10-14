#!/usr/bin/env python3
"""The GIFs this site must serve, derived from the store catalog.

Every app in apps/index.json whose apps/<slug>/app.json names a "gif" on this
site must have that file here, and no other GIF may be here except the ones in
SITE_GIFS. A checkout that lost GIFs, or picked up a stray one, fails the
deploy; a new app in the catalog needs no change here.

Run from the repository root. Prints one path per line; exits 1 on a mismatch.
"""
import json
import os
import sys

SITE_GIFS = {"_goal.gif"}  # served by the site itself, not by an app listing


def expected():
    want = set(SITE_GIFS)
    with open("apps/index.json", encoding="utf-8") as fh:
        apps = json.load(fh)["apps"]
    for app in apps:
        with open(os.path.join("apps", app["slug"], "app.json"), encoding="utf-8") as fh:
            gif = str(json.load(fh).get("gif") or "")
        if gif.startswith("/"):
            want.add(gif.lstrip("/"))
        elif gif.startswith("https://gifos.app/"):
            want.add(gif[len("https://gifos.app/"):])
        # any other https URL is hosted by the app's author, not here
    return want


def on_disk():
    found = set()
    for dirpath, dirs, names in os.walk("."):
        dirs[:] = [d for d in dirs if d not in (".git", "dist")]
        for name in names:
            if name.endswith(".gif"):
                found.add(os.path.relpath(os.path.join(dirpath, name), ".").replace(os.sep, "/"))
    return found


if __name__ == "__main__":
    want, have = expected(), on_disk()
    for path in sorted(want - have):
        print(f"::error::catalog lists {path}, which is not in this checkout")
    for path in sorted(have - want):
        print(f"::error::{path} is in this checkout but no catalog entry lists it")
    if want != have:
        sys.exit(1)
    for path in sorted(want):
        print(path)
