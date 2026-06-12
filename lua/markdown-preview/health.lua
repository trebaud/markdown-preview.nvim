local M = {}

function M.check()
    vim.health.start("markdown-preview.nvim")

    if vim.fn.has("nvim-0.10") == 1 then
        vim.health.ok("Neovim >= 0.10")
    else
        vim.health.error("Neovim >= 0.10 is required")
    end

    if vim.fn.executable("bun") == 1 then
        vim.health.ok("bun found: " .. vim.fn.exepath("bun"))
    else
        vim.health.error("bun not found", { "Install it from https://bun.sh" })
    end

    if vim.fn.executable("curl") == 1 then
        vim.health.ok("curl found")
    else
        vim.health.error("curl not found", { "curl is used to trigger live reloads on save" })
    end
end

return M
