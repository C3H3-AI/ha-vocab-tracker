# -*- coding: utf-8 -*-
"""
HA Vocab Tracker - 一键构建+部署到 HA
"""
import sys, os, subprocess, json, time, tempfile

sys.path.insert(0, "D:/ai-hub/scripts/ha_tools")
from ha_remote import HA

PROJECT = "D:/ai-hub/integrations/ha-vocab-tracker"
HA_WWW = "/config/www/vocab"
HA_PACKAGES = "/config/packages"

def run(cmd, cwd=None):
    print(f"$ {cmd}")
    r = subprocess.run(cmd, shell=True, cwd=cwd or PROJECT, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  ERROR: {r.stderr[:200]}")
        return False
    if r.stdout:
        for line in r.stdout.strip().split('\n')[-3:]:
            print(f"  {line}")
    return True

def main():
    ha = HA()
    
    # Step 1: npm install
    print("\n=== 1/5 安装依赖 ===")
    if not run("npm install"):
        # Try yarn
        if not run("yarn install"):
            print("⚠️ npm install failed, trying alternative...")
            # Use the managed node
            node = "C:/Users/duola/.workbuddy/binaries/node/versions/22.22.2/node.exe"
            npm = "C:/Users/duola/.workbuddy/binaries/node/versions/22.22.2/npm.cmd" if os.path.exists(
                "C:/Users/duola/.workbuddy/binaries/node/versions/22.22.2/npm.cmd") else "npm"
            run(f'"{node}" "{npm}" install')
    
    # Step 2: Build
    print("\n=== 2/5 构建前端 ===")
    if not run("npm run build"):
        run("npx vite build")
    
    # Check dist
    dist = os.path.join(PROJECT, "dist")
    if not os.path.exists(dist):
        # Try build with managed node
        node = "C:/Users/duola/.workbuddy/binaries/node/versions/22.22.2/node.exe"
        npx = os.path.join(os.path.dirname(node), "npx.cmd")
        run(f'"{node}" "{npx}" vite build')
    
    if not os.path.exists(dist):
        print("❌ Build failed, no dist directory")
        return
    
    files = os.listdir(dist)
    print(f"  构建产物: {files}")
    
    # Step 3: Upload to HA
    print("\n=== 3/5 上传到HA ===")
    def upload_dir(local_dir, remote_dir):
        for fname in os.listdir(local_dir):
            local = os.path.join(local_dir, fname)
            rel = os.path.relpath(local, dist).replace('\\', '/')
            remote = f"{HA_WWW}/{rel}"
            if os.path.isdir(local):
                ha.ssh(f"mkdir -p {remote}")
                upload_dir(local, remote)
            elif os.path.isfile(local):
                ha.upload_file(local, remote)
                print(f"  ✅ {rel}")
    try:
        ha.ssh(f"mkdir -p {HA_WWW}")
        upload_dir(dist, HA_WWW)
    except Exception as e:
        print(f"  ⚠️ Upload error: {e}")
        print("  ⚠️ 请手动复制 dist/ 目录到 HA /config/www/vocab/")
    
    # Step 4: Upload packages config
    print("\n=== 4/5 上传 HA 配置 ===")
    pkg_local = os.path.join(PROJECT, "config", "packages.yaml")
    if os.path.exists(pkg_local):
        try:
            ha.ssh(f"mkdir -p {HA_PACKAGES}")
            ha.upload_file(pkg_local, f"{HA_PACKAGES}/vocab_tracker.yaml")
            print("  ✅ packages.yaml uploaded")
        except Exception as e:
            print(f"  ⚠️ Upload error: {e}")
    
    # Step 5: Create dashboard
    print("\n=== 5/5 更新仪表盘 ===")
    try:
        config = ha.get_lovelace_config(url_path="dashboard-test")
        # Find or create vocab view
        vocab_view = None
        for v in config.get("views", []):
            if v.get("path") == "vocabulary":
                vocab_view = v
                break
        
        if not vocab_view:
            vocab_view = {"title": "词汇学习", "path": "vocabulary", "icon": "mdi:book-education", "panel": True}
            config.setdefault("views", []).append(vocab_view)
        
        vocab_view["panel"] = True
        vocab_view["cards"] = [
            {
                "type": "iframe",
                "url": "/local/vocab/index.html",
                "title": "词汇学习系统"
            }
        ]
        ha.save_lovelace_config(url_path="dashboard-test", config=config)
        print("  ✅ 仪表盘已更新")
    except Exception as e:
        print(f"  ⚠️ Dashboard update: {e}")
    
    print(f"\n✅ 部署完成！")
    print(f"📊 访问: http://api.homediy.top:8123/local/vocab/index.html")
    print(f"📋 仪表盘: http://api.homediy.top:8123/dashboard-dashboard-test/vocabulary")

if __name__ == "__main__":
    main()
