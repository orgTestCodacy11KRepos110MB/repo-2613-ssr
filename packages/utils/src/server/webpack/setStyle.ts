import type { StyleOptions, Chain } from 'ssr-types'
import { loadConfig } from '../loadConfig'
import { loadModuleFromFramework } from '../cwd'

const loadModule = loadModuleFromFramework
const setStyle = (chain: Chain, reg: RegExp, options: StyleOptions) => {
  const { css } = loadConfig()
  const { include, exclude, importLoaders, loader, isServer, priority } = options
  const userCssloaderOptions = css?.().loaderOptions?.cssOptions ?? {}
  const defaultCssloaderOptions = {
    importLoaders: importLoaders,
    modules: {
      // 对 .module.xxx 的文件开启 css-modules
      auto: true
    },

    url: (url: string) => {
      // 绝对路径开头的静态资源地址不处理
      return !url.startsWith('/')
    }
  }

  const finalCssloaderOptions = Object.assign({}, defaultCssloaderOptions, userCssloaderOptions)
  const postCssPlugins = css?.().loaderOptions?.postcss?.plugins ?? [] // 用户自定义 postcss 插件
  const userPostcssOptions = css?.().loaderOptions?.postcss?.options // postCssOptions maybe function|object
  const postcssOptions = typeof userPostcssOptions === 'function' ? userPostcssOptions : Object.assign({
    plugins: [
      require(loadModule('postcss-flexbugs-fixes')),
      require(loadModule('postcss-discard-comments')),
      [require(loadModule('postcss-preset-env')), {
        autoprefixer: {
          flexbox: 'no-2009'
        },
        stage: 3
      }]
    ].concat(postCssPlugins)
  }, userPostcssOptions ?? {}) // 合并用户自定义 postcss options
  const isPreprocess = ['css-loader', 'postcss-loader', 'less-loader', 'sass-loader'].includes(loader!)
  console.log(loader)
  if (!isPreprocess && !priority) {
    throw new Error('If you are using new loader you must assign loader priority')
  }
  const loaderPriority = Object.assign({
    'css-loader': {
      priority: 1,
      options: finalCssloaderOptions
    },
    'postcss-loader': {
      priority: 2,
      options: {
        postcssOptions: postcssOptions
      }
    }
  }, {
    [`${options.loader}`]: {
      priority: options.priority ?? 3
    }
  })
  Object.keys(loaderPriority).sort((a, b) => loaderPriority[a].priority - loaderPriority[b].priority).forEach(item => {
    console.log(item)
  })
  chain.module
    .rule(options.rule)
    .test(reg)
    .when(Boolean(include), rule => {
      include && rule.include.add(include).end()
    })
    .when(Boolean(exclude), rule => {
      exclude && rule.exclude.add(exclude).end()
    })
    .use('MiniCss')
    .loader(loadModule('ssr-mini-css-extract-plugin/dist/loader'))
    .options({
      emit: !isServer
    })
    .end()
    .use('css-loader')
    .loader(loadModule('css-loader'))
    .options(finalCssloaderOptions)
    .end()
    .use('postcss-loader')
    .loader(loadModule('postcss-loader'))
    .options({
      postcssOptions: postcssOptions
    })
    .end()
    .when(Boolean(loader), rule => {
      loader && rule.use(loader)
        .loader(loadModule(loader))
        .when(loader === 'less-loader', rule => {
          rule.options(Object.assign({
            lessOptions: {
              javascriptEnabled: true
            }
          }, css?.().loaderOptions?.less))
        })
        .when(loader === 'sass-loader', rule => {
          rule.options(css?.().loaderOptions?.sass ?? {})
        })
        .end()
    })
}

export {
  setStyle
}
