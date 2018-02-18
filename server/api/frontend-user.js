var md5 = require('md5')
var moment = require('moment')
var jwt = require('jsonwebtoken')

var mongoose = require('../mongoose')
var User = mongoose.model('User')

var config = require('../config')
var md5Pre = config.md5Pre
var secret = config.secretClient
var strlen = require('../utils').strlen
const general = require('./general')

const list = general.list
const modify = general.modify
const deletes = general.deletes
const recover = general.recover

exports.getList = async ctx => {
    await list(ctx, User)
}

/**
 * 用户登录
 * @method login
 * @param  {[type]}   ctx [description]
 * @return {[type]}       [description]
 */
exports.login = async ctx => {
    var password = ctx.request.body.password,
        username = ctx.request.body.username
    if (username === '' || password === '') {
        ctx.error('请输入用户名和密码')
    }
    try {
        const result = await User.findOneAsync({ username, password: md5(md5Pre + password), is_delete: 0 })
        if (result) {
            var id = result._id
            var remember_me = 2592000000
            username = encodeURI(username)
            var token = jwt.sign({id, username }, secret, {expiresIn: 60*60*24*30 })
            ctx.cookies.set('user', token, { maxAge: remember_me, httpOnly: false })
            ctx.cookies.set('userid', id, { maxAge: remember_me })
            ctx.cookies.set('username', new Buffer(username).toString('base64'), { maxAge: remember_me })
            ctx.success(token, '登录成功')
        } else {
            ctx.error('用户名或者密码错误')
        }
    } catch (err) {
        ctx.error(err.toString())
    }
}

/**
 * 微信登录
 * @method wxLogin
 * @param  {[type]}   ctx [description]
 * @return {[type]}       [description]
 */
exports.wxLogin = async ctx => {
    let json = {}
    const { nickName, wxSignature, avatar } = ctx.request.body
    if (!nickName || !wxSignature) {
        ctx.error('参数有误, 微信登录失败')
    } else {
        try {
            const result = await User.findOneAsync({
                username: nickName,
                wx_signature: wxSignature,
                is_delete: 0
            })
            if (result) {
                var id = result._id
                var username = encodeURI(nickName)
                var token = jwt.sign({ id, username }, secret, { expiresIn: 60*60*24*30 })
                ctx.success({
                    user: token,
                    userid: id,
                    username,
                }, '登录成功')
            } else {
                const _result = await User.createAsync({
                    username: nickName,
                    password: '',
                    email: '',
                    creat_date: moment().format('YYYY-MM-DD HH:mm:ss'),
                    update_date: moment().format('YYYY-MM-DD HH:mm:ss'),
                    is_delete: 0,
                    timestamp: moment().format('X'),
                    wx_avatar: avatar,
                    wx_signature: wxSignature,
                })
                var username = encodeURI(nickName)
                var id = _result._id
                var token = jwt.sign({ id, username }, secret, { expiresIn: 60*60*24*30 })
                ctx.success({
                    user: token,
                    userid: id,
                    username,
                }, '注册成功')
            }
        } catch (err) {
            ctx.error(err.toString())
        }
    }
}

/**
 * 用户登录
 * @method logout
 * @param  {[type]}   ctx [description]
 * @return {[type]}       [description]
 */
exports.logout = async ctx => {
    ctx.cookies.set('user', '', { maxAge: -1, httpOnly: false })
    ctx.cookies.set('userid', '', { maxAge: -1 })
    ctx.cookies.set('username', '', { maxAge: -1 })
    ctx.success('', '退出成功')
}

/**
 * 用户注册
 * @method insert
 * @param  {[type]}    ctx  [description]
 * @return {json}         [description]
 */
exports.insert = async ctx => {
    var email = ctx.request.body.email,
        password = ctx.request.body.password,
        username = ctx.request.body.username

    if (!username || !password || !email) {
        ctx.error('请将表单填写完整')
    } else if (strlen(username) < 4) {
        ctx.error('用户长度至少 2 个中文或 4 个英文')
    } else if (strlen(password) < 8) {
        ctx.error('密码长度至少 8 位')
    } else {
        try {
            const result = await User.findOneAsync({ username })
            if (result) {
                ctx.error('该用户名已经存在')
            } else {
                await User.createAsync({
                    username,
                    password: md5(md5Pre + password),
                    email,
                    creat_date: moment().format('YYYY-MM-DD HH:mm:ss'),
                    update_date: moment().format('YYYY-MM-DD HH:mm:ss'),
                    is_delete: 0,
                    timestamp: moment().format('X')
                })
                ctx.success('success', '注册成功')
            }
        } catch (err) {
            ctx.error(err.toString())
        }
    }
}

exports.getItem = async ctx => {
    var userid = ctx.query.id || ctx.cookies.get('userid') || ctx.header['userid']
    try {
        const result = await User.findOneAsync({ _id: userid, is_delete: 0 })
        if (result) {
            ctx.success(result)
        } else {
            ctx.error('请先登录, 或者数据错误')
        }
    } catch (err) {
        ctx.error(err.toString())
    }
}

/**
 * 用户编辑
 * @method modify
 * @param  {[type]}    ctx [description]
 * @return {[type]}        [description]
 */
exports.modify = async ctx => {
    var _id = ctx.request.body.id,
        email = ctx.request.body.email,
        password = ctx.request.body.password,
        update_date = moment().format('YYYY-MM-DD HH:mm:ss'),
        username = ctx.request.body.username
    var data = { email, username, update_date }
    if (password) data.password = md5(md5Pre + password)
    await modify(ctx, User, _id, data)
}


/**
 * 账号编辑
 * @method account
 * @param  {[type]}    ctx [description]
 * @return {[type]}        [description]
 */
exports.account = async ctx => {
    var _id = ctx.request.body.id,
        email = ctx.request.body.email,
        update_date = moment().format('YYYY-MM-DD HH:mm:ss'),
        user_id = ctx.cookies.get('userid') || ctx.header['userid'],
        username = ctx.request.body.username || ctx.header['username']
    if (user_id === _id) {
        try {
            await User.updateAsync({ _id }, { '$set': { email, username, update_date } })
            ctx.success('success', '更新成功')
        } catch (err) {
            ctx.error(err.toString())
        }
    } else {
        ctx.error('当前没有权限')
    }
}

/**
 * 密码编辑
 * @method password
 * @param  {[type]}    ctx [description]
 * @return {[type]}        [description]
 */
exports.password = async ctx => {
    var _id = ctx.request.body.id,
        old_password = ctx.request.body.old_password,
        password = ctx.request.body.password,
        update_date = moment().format('YYYY-MM-DD HH:mm:ss'),
        user_id = ctx.cookies.get('userid') || ctx.header['userid']
    if (user_id === _id) {
        try {
            const result = await User.findOneAsync({ _id, password: md5(md5Pre + old_password), is_delete: 0 })
            if (result) {
                await User.updateAsync({ _id }, { '$set': { password: md5(md5Pre + password), update_date } })
                ctx.success('success', '更新成功')
            } else {
                ctx.error('原始密码错误')
            }
        } catch (err) {
            ctx.error(err.toString())
        }
    } else {
        ctx.error('当前没有权限')
    }
}

/**
 * 用户删除
 * @method deletes
 * @param  {[type]}    ctx [description]
 * @param  {[type]}    res [description]
 * @return {[type]}        [description]
 */
exports.deletes = async ctx => {
    await deletes(ctx, User)
}

/**
 * 用户恢复
 * @method recover
 * @param  {[type]}    ctx [description]
 * @param  {[type]}    res [description]
 * @return {[type]}        [description]
 */
exports.recover = async ctx => {
    await recover(ctx, User)
}
