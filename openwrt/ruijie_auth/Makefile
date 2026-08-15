# OpenWrt / ImmortalWrt package for ruijie_auth
#
# 单包整合:包含认证守护进程 + LuCI Web 界面(中英双语、状态/启停/重启/日志)。
# 源码 src/ruijie_auth.c 是仓库根目录 ruijie_auth.c 的副本,更新源码后请同步覆盖。

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
  TITLE:=Ruijie 802.1X EAP-MD5 authentication client (with LuCI GUI)
  URL:=https://github.com/nyancatnevrox35-hub/openwrt_apk
  DEPENDS:=+luci-base
endef

define Package/ruijie_auth/description
  Reverse-engineered Ruijie (802.1X) EAP-MD5 client for OpenWrt/ImmortalWrt.
  Generates the Ruijie private trailer, supports post-auth DHCP trigger,
  daemon mode, and automatic re-authentication after link loss.
  Includes a LuCI web UI with Simplified Chinese/English translation,
  live status, start/stop/restart controls, and log viewing.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) $(CURDIR)/src/* $(PKG_BUILD_DIR)/
	$(CP) $(CURDIR)/po $(PKG_BUILD_DIR)/
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

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-ruijie_auth.json \
		$(1)/usr/share/rpcd/acl.d/luci-app-ruijie_auth.json

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-ruijie_auth.json \
		$(1)/usr/share/luci/menu.d/luci-app-ruijie_auth.json

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/ruijie_auth.js \
		$(1)/www/luci-static/resources/view/ruijie_auth.js

	# 预编译好的 .lmo(由 po2lmo 从 po/zh_Hans/ruijie_auth.po 生成并提交),
	# 编译期无需 luci-base/host 的 po2lmo,避免 SDK 下 host 工具未构建的失败。
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/po/zh_Hans/ruijie_auth.zh-cn.lmo \
		$(1)/usr/lib/lua/luci/i18n/ruijie_auth.zh-cn.lmo
endef

define Package/ruijie_auth/postinst
[ -n "$${IPKG_INSTROOT}" ] || { \
	/etc/init.d/ruijie_auth enable; \
	rm -f /tmp/luci-indexcache.*; \
	rm -rf /tmp/luci-modulecache/; \
	/etc/init.d/rpcd reload 2>/dev/null; \
}
exit 0
endef

$(eval $(call BuildPackage,ruijie_auth))
