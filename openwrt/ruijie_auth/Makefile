# OpenWrt / ImmortalWrt package for ruijie_auth
#
# 源码 src/ruijie_auth.c 是仓库根目录 ruijie_auth.c 的副本,
# 更新源码后请同步覆盖 src/ruijie_auth.c。

include $(TOPDIR)/rules.mk

PKG_NAME:=ruijie_auth
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=nyancatnevrox35-hub <nyancatnevrox35-hub@users.noreply.github.com>
# 源码未附带明确许可证,分发前请自行确认并补充 PKG_LICENSE
PKG_LICENSE:=Unknown

include $(INCLUDE_DIR)/package.mk

define Package/ruijie_auth
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Ruijie 802.1X EAP-MD5 authentication client
  URL:=https://github.com/nyancatnevrox35-hub/openwrt_apk
endef

define Package/ruijie_auth/description
  Reverse-engineered Ruijie (802.1X) EAP-MD5 client for OpenWrt/ImmortalWrt.
  Generates the Ruijie private trailer, supports post-auth DHCP trigger,
  daemon mode, and automatic re-authentication after link loss.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) $(CURDIR)/src/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) $(TARGET_LDFLAGS) \
		-o $(PKG_BUILD_DIR)/ruijie_auth $(PKG_BUILD_DIR)/ruijie_auth.c
endef

define Package/ruijie_auth/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/ruijie_auth $(1)/usr/sbin/ruijie_auth
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/ruijie_auth.init $(1)/etc/init.d/ruijie_auth
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/ruijie_auth.config $(1)/etc/config/ruijie_auth
endef

$(eval $(call BuildPackage,ruijie_auth))
