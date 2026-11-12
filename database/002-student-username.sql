-- Add a separate editable username. Email remains the school-managed login identity.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.Accounts', N'Username') IS NULL
    ALTER TABLE dbo.Accounts ADD Username nvarchar(50) COLLATE Latin1_General_100_CI_AS NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Accounts') AND name = N'UX_Accounts_Username')
    EXEC(N'CREATE UNIQUE INDEX UX_Accounts_Username ON dbo.Accounts(Username) WHERE Username IS NOT NULL;');
COMMIT TRANSACTION;
