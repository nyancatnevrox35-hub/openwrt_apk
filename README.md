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
- `SIGINT` / `SIGTERM` 收到后发送 EAPOL-Logoff 并优雅退出

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

仓库内 `openwrt/ruijie_auth/` 是一个标准的 OpenWrt 包定义，可直接放入 feed 或 SDK 编译成 `.ipk`。

目录结构：

```
openwrt/ruijie_auth/
├── Makefile                 # 包定义(源码取自 src/)
├── src/ruijie_auth.c        # 源文件(根目录 ruijie_auth.c 的副本,需同步)
└── files/
    ├── ruijie_auth.init     # procd 启动脚本
    └── ruijie_auth.config   # UCI 默认配置
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

产物位于 `bin/packages/<arch>/myfeed/ruijie_auth_1.0.0-1_<arch>.ipk`。

### 方法二：用 OpenWrt SDK 单独编译

```sh
# 在 SDK 根目录,把包目录软链/复制进 package/
cp -r /path/to/openwrt/ruijie_auth package/
make package/ruijie_auth/compile V=s
```

### 安装与配置

```sh
opkg install ruijie_auth_1.0.0-1_<arch>.ipk
vi /etc/config/ruijie_auth   # 填入 username/password,enabled 置 1
/etc/init.d/ruijie_auth enable
/etc/init.d/ruijie_auth start
```

包内含 procd 启动脚本，进程崩溃会自动拉起（`respawn`），配置变更（`/etc/config/ruijie_auth`）后自动重启服务。`--daemon` 选项在 procd 下无需使用（procd 已负责守护），但手动运行仍可用。procd 模式下日志固定写入 `/var/log/ruijie_auth.log`，供 Web 界面读取。

## Web 图形界面（LuCI）

仓库内 `openwrt/luci-app-ruijie_auth/` 是一个 LuCI 应用，提供网页配置与实时日志查看，支持简体中文 / English 切换（跟随 LuCI 系统的语言设置）。

目录结构：

```
openwrt/luci-app-ruijie_auth/
├── Makefile                                   # LuCI 应用定义(依赖 luci.mk)
├── htdocs/luci-static/resources/view/ruijie_auth.js   # 页面视图(表单 + 日志)
├── root/usr/share/luci/menu.d/...             # 菜单项(服务 -> Ruijie Auth)
├── root/usr/share/rpcd/acl.d/...              # 读写 UCI 与日志文件的权限
└── po/
    ├── templates/ruijie_auth.pot              # 英文源模板
    └── zh_Hans/ruijie_auth.po                 # 简体中文翻译
```

### 编译

LuCI 应用使用 `luci.mk`，需放到 LuCI feed 的 `applications/` 目录下：

```sh
cp -r openwrt/luci-app-ruijie_auth /path/to/luci/feed/applications/
./scripts/feeds install -a luci-app-ruijie_auth
make menuconfig          # LuCI -> Applications -> luci-app-ruijie_auth 选中
make package/luci-app-ruijie_auth/compile V=s
```

### 使用

1. 安装后登录 LuCI，在 **服务 → Ruijie Auth** 打开页面。
2. 页面可配置：启用开关、接口、用户名、密码、MAC、认证成功后运行 DHCP、DHCP 命令。
3. 页面下方 **日志** 区域显示 `/var/log/ruijie_auth.log` 的最近 200 行，点击 **刷新** 更新。
4. 语言切换：LuCI 系统设置（**系统 → 系统 → 语言和界面**）中选择 `简体中文` 或 `English`，本应用的界面文字随之切换。

## 运行

### 前台运行（调试）

```sh
./ruijie_auth -i eth0 -u 学号 -p 密码 --debug
```

### 后台守护 + 认证后自动获取 IP

```sh
./ruijie_auth -i eth0 -u 学号 -p 密码 --dhcp --daemon --log-file /var/log/ruijie.log
```

认证成功后 `--dhcp` 默认执行 `udhcpc -i <接口> -n -q`；需要自定义命令时用 `--dhcp-cmd`：

```sh
./ruijie_auth -i eth0 -u 学号 -p 密码 --dhcp-cmd "udhcpc -i %I -n -q -f"
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
- **认证服务器列表硬编码**：trailer 中的服务器列表为常量 `202.199.30.31;202.199.29.94`，如需修改请编辑源码中的 `AUTH_SERVERS`。

## 许可

仅供学习与研究使用。请遵守所在网络的使用规范与相关法律法规。
