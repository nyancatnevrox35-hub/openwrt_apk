# ruijie_auth

锐捷（Ruijie）802.1X EAP-MD5 认证客户端，面向 OpenWrt / ImmortalWrt 路由器，逆向重写自官方 `8021x.exe` 6.84。

程序使用 `AF_PACKET` 原始套接字绑定 `ETH_P_EAPOL`（0x888E），在链路层直接收发 802.1X 认证帧，并在认证成功后可选地触发 DHCP、以守护进程方式常驻，断链后自动重新认证。

## 功能特性

- 标准 EAP-MD5 认证流程（RFC 3748）：`EAPOL-Start → Request/Identity → Response/Identity → Request/MD5-Challenge → Response/MD5 → Success`
- 完整生成锐捷私有 585 字节 trailer（TLV 编码，含本机 MAC、环境指纹、服务器列表等字段）
- 认证成功后写入标记文件（可选）
- 认证成功后主动触发 DHCP（`--dhcp` / `--dhcp-cmd`）
- 后台守护运行（`--daemon`），日志可重定向到文件（`--log-file`）
- 物理链路断线检测，链路恢复后自动重新认证
- 失败自动重试、运行时网络错误自动重建套接字
- 认证服务器列表可配置（`--servers`，为空时使用内置默认值）
- `SIGINT` / `SIGTERM` 收到后发送 EAPOL-Logoff 并优雅退出
- LuCI Web 图形界面：状态 / 启动 / 停止 / 重启 / 日志查看，简体中文 / English 切换

## 编译

需要 Linux 内核头文件（`<linux/if_packet.h>` 等），只能在 Linux / OpenWrt 上编译。

```sh
# 本机 Linux（需 root 运行）
gcc -O2 -Wall -o ruijie_auth ruijie_auth.c

# OpenWrt 交叉编译（在 SDK / 工具链中）
mipsel-openwrt-linux-gcc -O2 -o ruijie_auth ruijie_auth.c
```

> 注：`isfinite` 为编译期内建宏，无需链接 `-lm`。程序使用原始套接字，运行必须具有 root 权限。

## 构建 OpenWrt / ImmortalWrt 软件包

仓库内 `openwrt/ruijie_auth/` 是一个标准的 OpenWrt 包定义，可直接放入 feed 或 SDK 编译。同一份 Makefile 无需改动即可产出 `.ipk`（opkg，旧版）或 `.apk`（apk，新版 OpenWrt/ImmortalWrt 主分支）。产物格式由所用工具链的包管理器决定。

目录结构：

```
openwrt/ruijie_auth/
├── Makefile                 # 包定义(守护进程 + LuCI 界面 + 中英翻译,单包)
├── src/ruijie_auth.c        # 源文件(根目录 ruijie_auth.c 的副本,需同步)
├── files/
│   ├── ruijie_auth.init     # procd 启动脚本
│   └── ruijie_auth.config   # UCI 默认配置
├── htdocs/luci-static/resources/view/ruijie_auth.js   # LuCI 页面视图
├── root/usr/share/luci/menu.d/...                    # 菜单项(服务 → Ruijie Auth)
├── root/usr/share/rpcd/acl.d/...                     # rpcd 读写 UCI / 日志 / 启停的 ACL
└── po/
    ├── templates/ruijie_auth.pot       # 英文源模板
    └── zh_Hans/ruijie_auth.po          # 简体中文翻译(编译期 po2lmo 生成 .lmo)
```

### 方法一：放入自定义 feed

```sh
# 假设你的 feed 位于 /home/user/myfeed
cp -r openwrt/ruijie_auth /home/user/myfeed/ruijie_auth
```

在 OpenWrt 源码根目录 `feeds.conf` 中登记该 feed，然后：

```sh
./scripts/feeds update -a
./scripts/feeds install -a ruijie_auth
make menuconfig          # Network -> ruijie_auth 选中
make package/ruijie_auth/compile V=s
```

产物位于 `bin/packages/<arch>/myfeed/`，旧工具链为 `ruijie_auth_1.0.0-1_<arch>.ipk`，apk 工具链为 `ruijie_auth-1.0.0-r1.apk`。

### 方法二：用 OpenWrt SDK 单独编译

```sh
# 在 SDK 根目录,把包目录软链/复制进 package/
cp -r /path/to/openwrt/ruijie_auth package/
make package/ruijie_auth/compile V=s
```

### 安装与配置（opkg / 旧版）

```sh
opkg install ruijie_auth_1.0.0-1_<arch>.ipk
vi /etc/config/ruijie_auth   # 填入 username/password,enabled 置 1
/etc/init.d/ruijie_auth enable
/etc/init.d/ruijie_auth start
```

### 安装与配置（apk / 新版 OpenWrt 与 ImmortalWrt）

OpenWrt 主线（snapshot）与 ImmortalWrt 已切换到 apk 包管理器，构建产物为 `.apk`。包名与文件名不带 `_<arch>` 后缀、版本号格式为 `-r<release>`：

```sh
apk add ./ruijie_auth-1.0.0-r1.apk
vi /etc/config/ruijie_auth   # 填入 username/password,enabled 置 1
/etc/init.d/ruijie_auth enable
/etc/init.d/ruijie_auth start
```

判断路由器用的是哪种包管理器：

```sh
which apk   # 存在即 apk,否则用 opkg
```

> 提示：apk 的包名固定为 `PKG_NAME`（即 `ruijie_auth`）。如需本地 feed 签名校验，apk 离线安装可用 `apk add --allow-untrusted ./xxx.apk`。

包内含 procd 启动脚本，进程崩溃会自动拉起（`respawn`），配置变更（`/etc/config/ruijie_auth`）后自动重启服务。`--daemon` 选项在 procd 下无需使用（procd 已负责守护），但手动运行仍可用。procd 模式下日志固定写入 `/var/log/ruijie_auth.log`，供 Web 界面读取。

## Web 图形界面（LuCI）

LuCI 界面已整合进 `ruijie_auth` 单包（无需单独安装 luci-app）。安装后登录 LuCI，在 **服务 → Ruijie Auth** 打开页面。

### 页面布局（自上而下）

1. **状态（Status）** —— 页面顶部，加粗显示当前运行状态：`运行中`（绿色）/ `已停止`（红色），随刷新实时更新。
2. **操作（Actions）** —— 一排按钮：**启动 / 停止 / 重启 / 刷新**，通过 rpcd 调用 `/etc/init.d/ruijie_auth` 完成。
3. **配置（Ruijie Authentication）** —— 标准 CBI 表单，含 **保存 / 保存并应用**：
   - **启用（Enabled）**：开关，是否随服务运行。
   - **接口（Interface）**：认证绑定的物理网口，默认 `eth0`。
   - **用户名（Username）**：认证账号（学号）。
   - **密码（Password）**：认证密码，密文显示。
   - **MAC 地址**：可选，留空自动采集网卡 MAC。
   - **服务器（Servers）**：`;` 分隔的认证服务器列表，留空用内置默认值。
   - **认证成功后运行 DHCP**：开关，勾选后认证成功自动拉取 IP。
   - **DHCP 命令**：自定义 DHCP 命令（`%I` = 接口名），仅在上项开启时显示。
4. **日志（Log）** —— 等宽字体滚动区，展示 `/var/log/ruijie_auth.log` 最近 200 行；无日志时显示「暂无日志输出」。

### 语言切换

页面文字跟随 LuCI 系统语言：在 **系统 → 系统 → 语言和界面** 选择 `简体中文` 或 `English`，界面即时切换。

> 说明：页面通过 rpcd `file.exec` 执行 `/etc/init.d/ruijie_auth {start,stop,restart,status}`。rpcd ACL 已随包安装（`/usr/share/rpcd/acl.d/`），仅授权这些固定命令，不开放任意命令执行。

## 云端编译（GitHub Actions）

无需本地 Linux 环境，直接在 GitHub 云端编译出 `.apk` 包。仓库内已包含工作流 `.github/workflows/build-apk.yml`，使用 ImmortalWrt 快照 SDK（已切换到 apk 包管理器）。

**默认目标**：`mediatek/filogic`（MediaTek MT7981 / Filogic 820，如 Cudy TR3000，包架构 `aarch64_cortex-a53`）。

### 触发方式

- **自动**：向 `main` 分支推送（改动 `ruijie_auth.c`、`openwrt/` 或工作流本身时触发）。
- **手动**：仓库页面 **Actions → Build OpenWrt apk packages → Run workflow**，可指定 `target` / `subtarget`（默认 `mediatek` / `filogic`）。

### 下载产物

编译完成后，在该次运行（run）页面底部的 **Artifacts** 下载 `ruijie-auth-<target>-<subtarget>-apk` 压缩包。由于 `ruijie_auth` 依赖 `luci-base`（及其 `lua` / `rpcd` / `ucode` / `cgi-io` 等依赖），产物中包含本包及其全部依赖 apk：

```
ruijie_auth-1.0.0-r1.apk              # 本包(守护进程 + LuCI 界面)
luci-base-*.apk lua-*.apk rpcd-*.apk ucode-*.apk ...   # 依赖
```

### 安装

把产物中所有 `.apk` 传到路由器后一次性离线安装：

```sh
apk add --allow-untrusted ./*.apk
```

安装后：

```sh
vi /etc/config/ruijie_auth   # 填入 username/password,enabled 置 1
/etc/init.d/ruijie_auth enable
/etc/init.d/ruijie_auth start
```

### 换架构

要编译其他架构的包，手动触发时修改 `target` / `subtarget`（对应 `downloads.immortalwrt.org/snapshots/targets/<target>/<subtarget>/`）。例如 MT7621 设备用 `target=ramips`、`subtarget=mt7621`。

## GitHub Releases

编译产出的 `.apk` 可挂到版本化 Release 上，便于下载与归档。

- **自动**：手动触发工作流（Actions → Run workflow）时勾选 `create_release`、填写 `release_tag`（如 `v1.0.0`），编译完成后会自动创建 Release 并附带全部 `.apk`。
- **手动**：下载 Artifact 后本地执行：

```sh
gh release create v1.0.0 dist/*.apk --title "ruijie-auth v1.0.0" --notes "锐捷认证客户端"
```

Release 列表：<https://github.com/nyancatnevrox35-hub/openwrt_apk/releases>

## APK 软件源（在线安装）

工作流每次编译都会生成 ADB 索引 `packages.adb`，与全部 `.apk` 一起推送到 `gh-pages` 分支。仓库为公开仓库，路由器可直接通过 `raw.githubusercontent.com` 匿名拉取安装，无需手动传包。

### 添加软件源

SSH 登录路由器，追加一条软件源（路径按实际 `target/subtarget` 调整）：

```sh
echo 'https://raw.githubusercontent.com/nyancatnevrox35-hub/openwrt_apk/gh-pages/mediatek/filogic/packages.adb' \
  >> /etc/apk/repositories.d/customfeeds.list
```

然后更新索引并安装：

```sh
apk update --allow-untrusted
apk add --allow-untrusted ruijie_auth
```

> 本软件源为**未签名**索引，故需 `--allow-untrusted`。依赖包（`luci-base` / `lua` / `rpcd` / `ucode` / `cgi-io` 等）已一并打入 feed，`apk add` 会自动解析并安装。

装好后按上文配置 `/etc/config/ruijie_auth`（填账号密码、`enabled` 置 1），再 `/etc/init.d/ruijie_auth enable && /etc/init.d/ruijie_auth start` 即可。

### 其他架构

对 `target=ramips`、`subtarget=mt7621` 等设备，把 URL 中的目录换成对应路径：

```sh
https://raw.githubusercontent.com/nyancatnevrox35-hub/openwrt_apk/gh-pages/ramips/mt7621/packages.adb
```

> 说明：ImmortalWrt 25.12.x 使用 apk，索引文件为 `packages.adb`（ADB 格式），与 OpenWrt 24.10 的 `Packages` 纯文本索引不同。官方源（`/etc/apk/repositories.d/distfeeds.list`）同样指向各自目录下的 `packages.adb`。

## 运行

> 装包后二进制位于 `/usr/sbin/ruijie_auth`（已在 `PATH` 中），直接 `ruijie_auth ...` 即可，**不要**用 `./ruijie_auth`（`./` 只在本机源码目录直接编译运行时才用）。路由器上推荐用 `/etc/init.d/ruijie_auth start` 或 LuCI 界面，手动运行主要用于调试。

### 前台运行（调试）

```sh
ruijie_auth -i eth0 -u 学号 -p 密码 --debug
```

### 后台守护 + 认证后自动获取 IP

```sh
ruijie_auth -i eth0 -u 学号 -p 密码 --dhcp --daemon --log-file /var/log/ruijie.log
```

认证成功后 `--dhcp` 默认执行 `udhcpc -i <接口> -n -q`；需要自定义命令时用 `--dhcp-cmd`：

```sh
ruijie_auth -i eth0 -u 学号 -p 密码 --dhcp-cmd "udhcpc -i %I -n -q -f"
```

`%I` 会被替换为实际接口名。

## 命令行选项

| 选项 | 说明 |
| --- | --- |
| `-i, --interface IF` | 网络接口（默认 `eth0` 或 `RUIJIE_INTERFACE`） |
| `-u, --username USER` | 802.1X 用户名（必填，或 `RUIJIE_USERNAME`） |
| `-p, --password PASS` | 802.1X 密码（必填，或 `RUIJIE_PASSWORD`） |
| `-m, --mac MAC` | 指定源 MAC（默认自动采集，或 `RUIJIE_MAC`） |
| `--timeout SEC` | 收包超时（默认 3.0） |
| `--retry-delay SEC` | 失败后重试间隔（默认 3.0） |
| `--start-burst N` | 每次尝试发送 EAPOL-Start 数量（默认 2） |
| `--no-start-trailer` | EAPOL-Start 不带 trailer |
| `--no-private-trailer` | 调试：标准 EAP-MD5，不带锐捷 trailer |
| `--debug` | 打印十六进制转储 |
| `--success-file PATH` | 认证成功后写入的文件（或 `RUIJIE_SUCCESS_FILE`） |
| `--dhcp` | 认证成功后执行 DHCP |
| `--dhcp-cmd CMD` | 认证成功后执行的命令（`%I` = 接口名） |
| `--servers LIST` | 认证服务器列表，`;` 分隔（默认内置值，或 `RUIJIE_SERVERS`） |
| `-d, --daemon` | 后台守护运行 |
| `--log-file PATH` | 日志追加到文件（守护模式默认 `/dev/null`） |
| `-h, --help` | 显示帮助 |

## 环境变量

| 变量 | 对应选项 |
| --- | --- |
| `RUIJIE_INTERFACE` | `-i` |
| `RUIJIE_USERNAME` | `-u` |
| `RUIJIE_PASSWORD` | `-p` |
| `RUIJIE_MAC` | `-m` |
| `RUIJIE_TIMEOUT` | `--timeout` |
| `RUIJIE_RETRY_DELAY` | `--retry-delay` |
| `RUIJIE_START_BURST` | `--start-burst` |
| `RUIJIE_SUCCESS_FILE` | `--success-file` |
| `RUIJIE_SERVERS` | `--servers` |

命令行参数优先级高于环境变量。

## 认证流程

1. 发送 EAPOL-Start（默认带锐捷私有 trailer）
2. 接收 `Request/Identity`，回复 `Response/Identity`（附 trailer）
3. 接收 `Request/MD5-Challenge`，计算 `MD5(EAP_id || password || challenge)` 并回复 `Response/MD5`（附 trailer）
4. 收到 `Success` 后：写入标记文件 → 触发 DHCP → 进入会话监控
5. 会话监控期间响应服务器的周期性重认证请求；检测到物理链路断开后等待恢复并重新认证

## 已知限制

- **明文密码暴露**：`-p` 参数与环境变量会出现在 `ps` 及 `/proc/<pid>/environ` 中，多用户环境下建议用配置文件的只读权限规避。
- **EAP-MD5 固有弱点**：MD5 挑战响应易受离线字典攻击，这是协议本身的限制，非本实现缺陷。
- **随机数回退**：优先用 `/dev/urandom`，失败时回退 `rand()`（弱随机，仅用于设备指纹字段，不参与密钥派生）。
- **认证服务器默认值内置**：`--servers` 未指定时，trailer 中的服务器列表回退为内置常量 `202.199.30.31;202.199.29.94`；可通过 `--servers` 或 UCI `servers` 覆盖，无需改源码。

## 许可

仅供学习与研究使用。请遵守所在网络的使用规范与相关法律法规。
