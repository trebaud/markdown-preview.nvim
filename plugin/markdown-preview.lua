if vim.g.loaded_markdown_preview then
    return
end
vim.g.loaded_markdown_preview = true

if vim.fn.has("nvim-0.10") == 0 then
    vim.notify("markdown-preview.nvim requires Neovim >= 0.10", vim.log.levels.ERROR)
    return
end

vim.api.nvim_create_user_command("MarkdownPreview", function()
    require("markdown-preview").start()
end, { desc = "Preview markdown in browser" })

vim.api.nvim_create_user_command("MarkdownPreviewStop", function()
    require("markdown-preview").stop()
end, { desc = "Stop markdown preview" })

vim.api.nvim_create_autocmd("VimLeavePre", {
    group = vim.api.nvim_create_augroup("MarkdownPreviewLifecycle", { clear = true }),
    callback = function()
        require("markdown-preview").stop()
    end,
})
