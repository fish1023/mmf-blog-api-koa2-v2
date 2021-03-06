const moment = require('moment')
const mongoose = require('../mongoose')
const Comment = mongoose.model('Comment')
const Article = mongoose.model('Article')

/**
 * 发布评论
 * @method
 * @param  {[type]} ctx [description]
 * @return {[type]}     [description]
 */
exports.insert = async ctx => {
    const { id, content } = ctx.request.body
    if (!id) {
        ctx.error('参数错误')
        return
    } else if (!content) {
        ctx.error('请输入评论内容')
        return
    }
    const avatar = ctx.request.body.avatar || ''
    const creat_date = moment().format('YYYY-MM-DD HH:mm:ss')
    const timestamp = moment().format('X')
    const update_date = moment().format('YYYY-MM-DD HH:mm:ss')
    const userid = ctx.cookies.get('userid') || ctx.header['userid']
    let username = ctx.cookies.get('username') || ctx.header['username']
    username = new Buffer(username, 'base64').toString()
    username = decodeURI(username)
    const data = {
        avatar,
        article_id: id,
        userid,
        username,
        email: '',
        content,
        creat_date,
        is_delete: 0,
        timestamp,
        update_date,
    }
    try {
        const result = await Comment.createAsync(data)
        await Article.updateAsync({ _id: id }, { $inc: { comment_count: 1 } })
        ctx.success(result)
    } catch (err) {
        ctx.error(err.toString())
    }
}

/**
 * 前台浏览时, 读取评论列表
 * @method
 * @param  {[type]} ctx [description]
 * @return {[type]}     [description]
 */
exports.getList = async ctx => {
    const { all, id } = ctx.query
    let { limit, page } = ctx.query
    if (!id) {
        ctx.error('参数错误')
    } else {
        page = parseInt(page, 10)
        limit = parseInt(limit, 10)
        if (!page) page = 1
        if (!limit) limit = 10
        const data = {
                article_id: id,
            },
            skip = (page - 1) * limit
        if (!all) {
            data.is_delete = 0
        }
        try {
            const [list, total] = await Promise.all([
                Comment.find(data)
                    .sort('-_id')
                    .skip(skip)
                    .limit(limit)
                    .exec(),
                Comment.countAsync(data),
            ])
            const totalPage = Math.ceil(total / limit)
            ctx.success({
                list,
                total,
                hasNext: totalPage > page ? 1 : 0,
            })
        } catch (err) {
            ctx.error(err.toString())
        }
    }
}

/**
 * 评论删除
 * @method deleteAdmin
 * @param  {[type]}    ctx [description]
 * @return {[type]}        [description]
 */
exports.deletes = async ctx => {
    const _id = ctx.query.id
    try {
        await Comment.updateAsync({ _id }, { is_delete: 1 })
        await Article.updateAsync({ _id }, { $inc: { comment_count: -1 } })
        ctx.success('success', '删除成功')
    } catch (err) {
        ctx.error(err.toString())
    }
}

/**
 * 评论恢复
 * @method deleteAdmin
 * @param  {[type]}    ctx [description]
 * @return {[type]}        [description]
 */
exports.recover = async ctx => {
    const _id = ctx.query.id
    try {
        await Comment.updateAsync({ _id }, { is_delete: 0 })
        await Article.updateAsync({ _id }, { $inc: { comment_count: 1 } })
        ctx.success('success', '恢复成功')
    } catch (err) {
        ctx.error(err.toString())
    }
}
