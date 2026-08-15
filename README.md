# ruijie_auth

锐捷（Ruijie）802.1X EAP-MD5 认证客户端，面向 OpenWrt / ImmortalWrt 路由器，逆向重写自官方 `8021x.exe` 6.84。

程序使用 `AF_PACKET` 原始套接字绑定 `ETH_P_EAPOL`（0x888E），在链路层直接收发 802.1X 认证帧，认证成功后可选触发 DHCP、以守护进程常驻，断链后自动重新认证。

## 功能特性

- 标准 EAP-MD5 认证流程（RFC 3748）
- 完整生成锐捷私有 585 字节 trailer（TLV 编码，含本机 MAC、环境指纹、服务器列表）
- 认证成功后可选触发 DHCP
- 后台守护运行（`--daemon`）、日志重定向（`--log-file`）
- 链路断开自动检测，恢复后自动重新认证；失败自动重试、套接字自动重建
- 认证服务器列表可配置（`--servers`，留空用内置默认）
- `SIGINT` / `SIGTERM` 收到后发送 EAPOL-Logoff 并优雅退出
- LuCI Web 图形界面：状态 / 启停 / 日志，简体中文 / English 切换

## 安装

路由器按包管理器分为两类：**apk**（OpenWrt 快照 / ImmortalWrt 25.12+）与 **opkg**（OpenWrt 23.05 及更早）。先用以下命令确认：

```sh
which apk && echo apk || echo opkg
```

### 方式一：APK 软件源在线安装（推荐）

仓库公开，`gh-pages` 分支提供 ADB 索引 `packages.adb` 及全部依赖包，路由器可匿名在线安装，无需手动传包：

```sh
echo 'https://raw.githubusercontent.com/nyancatnevrox35-hub/openwrt_apk/gh-pages/mediatek/filogic/packages.adb' \
  >> /etc/apk/repositories.d/customfeeds.list
apk update --allow-untrusted
apk add --allow-untrusted ruijie_auth
```

> 索引未签名，故需 `--allow-untrusted`。依赖（`luci-base` / `lua` / `rpcd` / `ucode` / `cgi-io` 等）已一并打入 feed，自动解析安装。
>
> 其他架构把 URL 中的 `mediatek/filogic` 换成对应 `target/subtarget`（如 `ramips/mt7621`）。索引为 ADB 格式 `packages.adb`，与官方源一致。

### 方式二：离线安装 .apk / .ipk

从 [GitHub Releases](https://github.com/nyancatnevrox35-hub/openwrt_apk/releases) 或工作流 Artifacts 下载包并传到路由器：

```sh
# apk（新版）
apk add --allow-untrusted ./*.apk

# opkg（旧版）
opkg install ruijie_auth_1.0.0-1_<arch>.ipk
```

## 配置与运行

安装后编辑 `/etc/config/ruijie_auth`，填入学号 / 密码并把 `enabled` 置 1：

```sh
vi /etc/config/ruijie_auth
```

关键字段：

| 字段 | 说明 |
| --- | --- |
| `enabled` | `1` 表示随服务启动 |
| `interface` | 认证绑定的物理网口，默认 `eth0` |
| `username` | 认证账号（学号） |
| `password` | 认证密码 |
| `mac` | 可选，留空自动采集网卡 MAC |
| `servers` | `;` 分隔的认证服务器列表，留空用内置默认 |
| `dhcp` | `1` 表示认证成功后自动触发 DHCP |
| `dhcp_cmd` | 自定义 DHCP 命令（`%I` = 接口名），`dhcp=1` 时生效 |

### 服务管理

```sh
/etc/init.d/ruijie_auth enable   # 开机自启
/etc/init.d/ruijie_auth start    # 启动
/etc/init.d/ruijie_auth stop     # 停止
/etc/init.d/ruijie_auth restart  # 重启
```

包内含 procd 启动脚本：进程崩溃自动 `respawn`，`/etc/config/ruijie_auth` 变更后自动重启。procd 模式下日志固定写入 `/var/log/ruijie_auth.log`，供 Web 界面读取。

### 手动运行（调试）

装包后二进制位于 `/usr/sbin/ruijie_auth`，直接调用即可（**不要**用 `./` 前缀，`./` 仅在本机源码目录直接编译运行时才用）：

```sh
# 前台调试
ruijie_auth -i eth0 -u 学号 -p 密码 --debug

# 后台守护 + 认证成功后自动 DHCP
ruijie_auth -i eth0 -u 学号 -p 密码 --dhcp --daemon --log-file /var/log/ruijie.log
```

认证成功后 `--dhcp` 默认执行 `udhcpc -i <接口> -n -q`；自定义命令用 `--dhcp-cmd`（`%I` = 接口名）。

## Web 图形界面（LuCI）

LuCI 界面已整合进 `ruijie_auth` 单包（无需单独安装 luci-app）。登录 LuCI，进入 **服务 → Ruijie Auth**。

页面自上而下：

1. **状态（Status）**：顶部加粗显示 `运行中`（绿）/ `已停止`（红），随刷新实时更新。
2. **操作（Actions）**：启动 / 停止 / 重启 / 刷新，经 rpcd 调用 `/etc/init.d/ruijie_auth`。
3. **配置（Ruijie Authentication）**：标准 CBI 表单（保存 / 保存并应用），字段对应上表。
4. **日志（Log）**：等宽滚动区，展示 `/var/log/ruijie_auth.log` 最近 200 行。

语言跟随 LuCI 系统语言（**系统 → 系统 → 语言和界面** 选 `简体中文` / `English`）即时切换。

> 页面通过 rpcd `file.exec` 执行 `/etc/init.d/ruijie_auth {start,stop,restart,status}`；rpcd ACL 已随包安装，仅授权这些固定命令，不开放任意命令执行。

## 命令行参考

### 选项

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

### 环境变量

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

## 从源码构建

### 直接编译（本机 Linux）

需要 Linux 内核头文件（`<linux/if_packet.h>` 等），仅限 Linux / OpenWrt 上编译：

```sh
gcc -O2 -Wall -o ruijie_auth ruijie_auth.c
```

OpenWrt 交叉编译（在 SDK / 工具链中）：

```sh
mipsel-openwrt-linux-gcc -O2 -o ruijie_auth ruijie_auth.c
```

> `isfinite` 为编译期内建宏，无需链接 `-lm`。程序使用原始套接字，运行必须具有 root 权限。

### 构建 OpenWrt / ImmortalWrt 软件包

`openwrt/ruijie_auth/` 是标准 OpenWrt 包定义，同一份 Makefile 依工具链自动产出 `.ipk`（opkg，旧版）或 `.apk`（apk，新版）。

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

#### 方法一：放入自定义 feed

```sh
cp -r openwrt/ruijie_auth /home/user/myfeed/ruijie_auth   # 复制到你的 feed
```

在 OpenWrt 源码根目录 `feeds.conf` 登记该 feed 后：

```sh
./scripts/feeds update -a
./scripts/feeds install -a ruijie_auth
make menuconfig                 # Network -> ruijie_auth 选中
make package/ruijie_auth/compile V=s
```

产物位于 `bin/packages/<arch>/myfeed/`：旧工具链为 `ruijie_auth_1.0.0-1_<arch>.ipk`，apk 工具链为 `ruijie_auth-1.0.0-r1.apk`。

#### 方法二：用 SDK 单独编译

```sh
cp -r /path/to/openwrt/ruijie_auth package/   # SDK 根目录
make package/ruijie_auth/compile V=s
```

### 云端编译（GitHub Actions）

无需本地 Linux，仓库内 `.github/workflows/build-apk.yml` 使用 ImmortalWrt 快照 SDK 在 GitHub 云端编译 `.apk`。

- **触发**：推送到 `main`（改动 `ruijie_auth.c` / `openwrt/` / 工作流时自动），或手动 **Actions → Build OpenWrt apk packages → Run workflow**（可指定 `target` / `subtarget`，默认 `mediatek` / `filogic`）。
- **产物**：run 页底部 Artifacts 下载 `ruijie-auth-<target>-<subtarget>-apk`，含本包及全部依赖 apk。

### GitHub Releases

编译产物可挂到版本化 Release。手动触发时勾选 `create_release`、填 `release_tag`（如 `v1.0.0`），编译完成后自动创建 Release 并附带全部 `.apk`；也可下载 Artifact 后本地执行：

```sh
gh release create v1.0.0 dist/*.apk --title "ruijie-auth v1.0.0" --notes "锐捷认证客户端"
```

Release 列表：<https://github.com/nyancatnevrox35-hub/openwrt_apk/releases>

### 生成 APK 软件源（feed）

工作流编译后自动运行 `apk mkndx` 生成 `packages.adb`，连同全部 `.apk` 推送到 `gh-pages` 分支，供路由器在线安装（见上文「方式一」）。

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
