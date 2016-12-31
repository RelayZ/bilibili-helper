// ==UserScript==
// @name         解除B站区域限制
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  把获取视频地址相关接口的返回值替换成我的反向代理服务器的返回值; 因为替换值的操作是同步的, 所有会卡几下..., 普通视频不受影响; 我的服务器有点渣, 没获取成功请多刷新几下; 当前只支持bangumi.bilibili.com域名下的番剧视频; 
// @author       ipcjs
// @include      http://bangumi.bilibili.com/anime/*
// @include      http://bangumi.bilibili.com/anime/v/*
// @include      http://www.bilibili.com/html/html5player.html*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      biliplus.com
// @connect      biliplus.ipcjsdev.tk
// ==/UserScript==

/**
 * 把获取视频地址相关接口的返回值替换成biliplus的接口的返回值,
 * 因为替换值的操作是同步的, 所有会卡几下..., 又因为biliplus的接口不支持跨域请求, 所以使用了我自己的服务器做反向代理(-_-#);
 * 源码仓库: https://github.com/ipcjs/bilibili-helper/tree/user.js
 */

(function () {
    'use strict';
    var biliplusHost = 'http://biliplus.ipcjsdev.tk';
    // var biliplusHost = 'https://www.biliplus.com';
    console.log('[' + GM_info.script.name + '] run on: ' + unsafeWindow.location.href);
    if (!unsafeWindow.jQuery) { // 若还未加载jQuery, 则监听
        var jQuery;
        Object.defineProperty(unsafeWindow, 'jQuery', {
            configurable: true, enumerable: true, set: function (v) {
                jQuery = v;
                injectDataFilter();// 设置jQuery后, 立即注入
            }, get: function () {
                return jQuery;
            }
        });
    } else {
        injectDataFilter();
    }

    function injectDataFilter() {
        unsafeWindow.jQuery.ajaxSetup({
            dataFilter: function (data, type) {
                var json, obj, group, params;
                // console.log(arguments, this);
                if (this.url.startsWith('http://bangumi.bilibili.com/web_api/get_source')) {
                    // 获取cid API
                    console.log(data);
                    json = JSON.parse(data);
                    if (json.code === -40301) {
                        $.ajax({
                            url: biliplusHost + '/api/view?id=' + unsafeWindow.aid,
                            async: false,
                            xhrFields: {withCredentials: true},
                            success: function (result) {
                                obj = {
                                    code: 0, message: 'success', result: {
                                        episode_status: 2,
                                        pre_ad: 0,
                                        season_status: 2
                                    }
                                };
                                obj.result.aid = result.id;
                                obj.result.cid = result.list[0].cid;
                                obj.result.player = result.list[0].type;
                                obj.result.vid = result.list[0].vid;
                                data = JSON.stringify(obj);
                                console.log('==>', data);
                                // console.log('success', arguments, this);
                            },
                            error: function () {
                                console.log('error', arguments, this);
                            }
                        });
                    }
                } else if (this.url.startsWith('https://bangumi.bilibili.com/player/web_api/playurl')) {
                    // 获取视频地址 API
                    console.log(data);
                    json = JSON.parse(data);
                    if (json.durl.length === 1 && json.durl[0].length === 15126 && json.durl[0].size === 124627) {
                        // https://bangumi.bilibili.com/player/web_api/playurl?cid=10482695&appkey=84956560bc028eb7&otype=json&type=flv&quality=4&module=bangumi&sign=f77367cf031933161a5b6ff8c29a011e
                        // https://biliplus.com/BPplayurl.php?cid=10482695|bangumi&player=1&ts=12345678
                        // ==> http://biliplus.ipcjsdev.tk/BPplayurl.php?cid=10482695|bangumi&otype=json&type=flv&quality=4
                        params = {
                            cid: getParam(this.url, 'cid') + '|bangumi',
                            otype: getParam(this.url, 'otype'),
                            type: getParam(this.url, 'type'),
                            quality: getParam(this.url, 'quality')
                        };
                        $.ajax({
                            url: biliplusHost + '/BPplayurl.php?' + Object.keys(params).map(function (key) {
                                return key + '=' + params[key];
                            }).join('&'),
                            async: false,
                            xhrFields: {withCredentials: true},
                            success: function (result) {
                                // console.log('success', arguments, this);
                                obj = result;
                                if (obj.durl.length === 1 && obj.durl[0].length == 15126 && obj.durl[0].size === 124627) {
                                    if (unsafeWindow.confirm('试图获取视频地址失败, 请登录biliplus' +
                                            '\n注意: 只支持"使用bilibili账户密码进行登录"'
                                        )) {
                                        unsafeWindow.top.location = biliplusHost + '/login';
                                    }
                                } else {
                                    data = JSON.stringify(obj);
                                    console.log('==>', data);
                                }
                            },
                            error: function () {
                                console.log('error', arguments, this);
                            }
                        });
                    }
                } else if (this.url.startsWith('http://bangumi.bilibili.com/web_api/season_area')) {
                    // 番剧页面是否要隐藏番剧列表 API
                    console.log(data);
                    json = JSON.parse(data);
                    // 限制区域时的data为:
                    // {"code":0,"message":"success","result":{"play":0}}
                    if (json.code === 0 && json.result && json.result.play === 0) {
                        json.result.play = 1; // 改成1就能够显示
                        data = JSON.stringify(json);
                        console.log('==>', data);
                    }
                }
                return data;
            }
        });
    }

    function getParam(url, key) {
        return (url.match(new RegExp('[?|&]' + key + '=(\\w+)')) || ['', ''])[1];
    }
})();