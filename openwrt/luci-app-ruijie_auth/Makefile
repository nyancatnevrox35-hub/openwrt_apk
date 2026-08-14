# LuCI application for ruijie_auth (web UI)
#
# 注意:本包使用 luci.mk,需放到 LuCI feed 的 applications/ 目录下编译,
# 即 <luci_feed>/applications/luci-app-ruijie_auth/。

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ruijie_auth
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=Unknown
PKG_MAINTAINER:=nyancatnevrox35-hub <nyancatnevrox35-hub@users.noreply.github.com>

LUCI_TITLE:=Ruijie 802.1X Authentication
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+luci-base +ruijie_auth

include ../../luci.mk

# call BuildPackage - OpenWrt build system signature
