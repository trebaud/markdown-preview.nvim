local M = {}

-- Locate the plugin's bundled bun server relative to this file:
-- <plugin-root>/lua/markdown-preview/init.lua -> <plugin-root>/bun
local source = debug.getinfo(1, "S").source:sub(2)
local root = vim.fs.normalize(vim.fs.joinpath(vim.fs.dirname(source), "..", "..", "bun"))

local state = { job = nil, port = nil }

local function notify(msg, level)
    vim.notify(msg, level or vim.log.levels.INFO, { title = "markdown-preview" })
end

function M.stop()
    if state.job then
        vim.fn.jobstop(state.job)
    end
end

local function ping()
    if state.port then
        vim.system({ "curl", "-s", "-XPOST", "http://127.0.0.1:" .. state.port .. "/reload" })
    end
end

function M.start()
    local file = vim.api.nvim_buf_get_name(0)
    if file == "" then
        return notify("save the buffer to a file first", vim.log.levels.WARN)
    end
    if vim.fn.executable("bun") == 0 then
        return notify("bun is required (https://bun.sh)", vim.log.levels.ERROR)
    end
    M.stop()
    if not vim.uv.fs_stat(root .. "/node_modules") then
        notify("installing dependencies...")
        vim.system({ "bun", "install" }, { cwd = root }):wait()
    end
    state.job = vim.fn.jobstart({ "bun", "run", root .. "/server.ts", file }, {
        cwd = root,
        on_stdout = function(_, lines)
            local port = table.concat(lines):match("PORT:(%d+)")
            if port and not state.port then
                state.port = port
                vim.ui.open("http://127.0.0.1:" .. port .. "/")
            end
        end,
        on_exit = function()
            state.job, state.port = nil, nil
        end,
    })
    vim.api.nvim_create_autocmd("BufWritePost", {
        buffer = 0,
        group = vim.api.nvim_create_augroup("MarkdownPreview", { clear = true }),
        callback = ping,
    })
end

-- No-op kept so specs using `opts = {}` / explicit setup() calls keep working.
-- Commands and autocmds are registered in plugin/markdown-preview.lua.
function M.setup() end

return M
