-- Run in SSMS against your existing ITsCash database.
-- Safe to run again: this creates missing tables and never clears existing records.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Accounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Accounts (
        AccountId uniqueidentifier NOT NULL CONSTRAINT PK_Accounts PRIMARY KEY,
        Email nvarchar(254) COLLATE Latin1_General_100_CI_AS NOT NULL,
        PasswordHash nvarchar(512) NOT NULL,
        FullName nvarchar(150) NOT NULL,
        Role nvarchar(30) NOT NULL,
        StudentNumber nvarchar(50) NULL,
        Course nvarchar(150) NOT NULL DEFAULT N'',
        YearLevel nvarchar(50) NOT NULL DEFAULT N'',
        Phone nvarchar(30) NOT NULL DEFAULT N'',
        Gender nvarchar(50) NOT NULL DEFAULT N'Prefer not to say',
        DateOfBirth date NULL,
        Avatar nvarchar(max) NOT NULL DEFAULT N'',
        Active bit NOT NULL DEFAULT 1,
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Accounts_Email UNIQUE (Email),
        CONSTRAINT CK_Accounts_Role CHECK (Role IN (N'Student', N'Cashier', N'Proware', N'Admin', N'Inventory Staff')),
        CONSTRAINT CK_Accounts_Student CHECK (Role <> N'Student' OR (StudentNumber IS NOT NULL AND LEN(StudentNumber) > 0))
    );
    CREATE UNIQUE INDEX UX_Accounts_StudentNumber ON dbo.Accounts(StudentNumber)
        WHERE Role = N'Student' AND StudentNumber IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
    CREATE TABLE dbo.Products (
        ProductId nvarchar(64) NOT NULL CONSTRAINT PK_Products PRIMARY KEY,
        Code nvarchar(50) NOT NULL,
        Name nvarchar(200) NOT NULL,
        Description nvarchar(2000) NOT NULL DEFAULT N'',
        Category nvarchar(100) NOT NULL DEFAULT N'',
        Program nvarchar(150) NOT NULL DEFAULT N'',
        ImageUrl nvarchar(2000) NOT NULL DEFAULT N'',
        PriceCents bigint NOT NULL CHECK (PriceCents >= 0),
        Active bit NOT NULL DEFAULT 1
    );

IF OBJECT_ID(N'dbo.ProductStock', N'U') IS NULL
    CREATE TABLE dbo.ProductStock (
        ProductId nvarchar(64) NOT NULL REFERENCES dbo.Products(ProductId),
        Size nvarchar(30) NOT NULL,
        Quantity int NOT NULL CHECK (Quantity >= 0),
        CONSTRAINT PK_ProductStock PRIMARY KEY (ProductId, Size)
    );

IF OBJECT_ID(N'dbo.Assessments', N'U') IS NULL
    CREATE TABLE dbo.Assessments (
        AssessmentId uniqueidentifier NOT NULL CONSTRAINT PK_Assessments PRIMARY KEY,
        StudentId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        SchoolYear nvarchar(30) NOT NULL,
        Semester nvarchar(30) NOT NULL,
        PaymentPlan nvarchar(30) NOT NULL CHECK (PaymentPlan IN (N'Full', N'Installment')),
        AdjustmentCents bigint NOT NULL DEFAULT 0,
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Assessments_Term UNIQUE (StudentId, SchoolYear, Semester)
    );

IF OBJECT_ID(N'dbo.AssessmentFees', N'U') IS NULL
    CREATE TABLE dbo.AssessmentFees (
        FeeId uniqueidentifier NOT NULL CONSTRAINT PK_AssessmentFees PRIMARY KEY,
        AssessmentId uniqueidentifier NOT NULL REFERENCES dbo.Assessments(AssessmentId),
        Label nvarchar(150) NOT NULL,
        AmountCents bigint NOT NULL CHECK (AmountCents >= 0)
    );

IF OBJECT_ID(N'dbo.AssessmentInstallments', N'U') IS NULL
    CREATE TABLE dbo.AssessmentInstallments (
        AssessmentId uniqueidentifier NOT NULL REFERENCES dbo.Assessments(AssessmentId),
        InstallmentNumber int NOT NULL CHECK (InstallmentNumber > 0),
        DueDate date NOT NULL,
        AmountCents bigint NOT NULL CHECK (AmountCents >= 0),
        CONSTRAINT PK_AssessmentInstallments PRIMARY KEY (AssessmentId, InstallmentNumber)
    );

IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
    CREATE TABLE dbo.Orders (
        OrderId uniqueidentifier NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
        StudentId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        Status nvarchar(30) NOT NULL CHECK (Status IN (N'Awaiting Payment', N'Paid', N'Ready for Pickup', N'Claimed', N'Cancelled')),
        PaymentMethod nvarchar(30) NOT NULL,
        TotalCents bigint NOT NULL CHECK (TotalCents >= 0),
        StockReserved bit NOT NULL DEFAULT 0,
        RecipientName nvarchar(150) NOT NULL,
        ContactEmail nvarchar(254) NOT NULL,
        ContactPhone nvarchar(30) NOT NULL,
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

IF OBJECT_ID(N'dbo.OrderItems', N'U') IS NULL
    CREATE TABLE dbo.OrderItems (
        OrderId uniqueidentifier NOT NULL REFERENCES dbo.Orders(OrderId),
        ProductId nvarchar(64) NOT NULL REFERENCES dbo.Products(ProductId),
        Size nvarchar(30) NOT NULL,
        ProductName nvarchar(200) NOT NULL,
        Quantity int NOT NULL CHECK (Quantity > 0),
        UnitPriceCents bigint NOT NULL CHECK (UnitPriceCents >= 0),
        CONSTRAINT PK_OrderItems PRIMARY KEY (OrderId, ProductId, Size)
    );

IF OBJECT_ID(N'dbo.Payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Payments (
        PaymentId uniqueidentifier NOT NULL CONSTRAINT PK_Payments PRIMARY KEY,
        StudentId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        RecordedBy uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        Purpose nvarchar(20) NOT NULL,
        OrderId uniqueidentifier NULL REFERENCES dbo.Orders(OrderId),
        AssessmentId uniqueidentifier NULL REFERENCES dbo.Assessments(AssessmentId),
        Method nvarchar(30) NOT NULL,
        Reference nvarchar(100) NULL,
        Status nvarchar(20) NOT NULL CHECK (Status IN (N'Pending', N'Successful', N'Failed', N'Refunded')),
        AmountCents bigint NOT NULL CHECK (AmountCents > 0),
        ReceivedCents bigint NULL CHECK (ReceivedCents >= 0),
        ChangeCents bigint NULL CHECK (ChangeCents >= 0),
        ReceiptNumber nvarchar(100) NULL,
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        VerifiedAt datetime2 NULL,
        RefundedAt datetime2 NULL,
        CONSTRAINT CK_Payments_Target CHECK (
            (Purpose = N'Uniform' AND OrderId IS NOT NULL AND AssessmentId IS NULL) OR
            (Purpose = N'Tuition' AND AssessmentId IS NOT NULL AND OrderId IS NULL))
    );
    CREATE UNIQUE INDEX UX_Payments_Reference ON dbo.Payments(Method, Reference) WHERE Reference IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.CheckoutTickets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CheckoutTickets (
        TicketId uniqueidentifier NOT NULL CONSTRAINT PK_CheckoutTickets PRIMARY KEY,
        StudentId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        OrderId uniqueidentifier NULL REFERENCES dbo.Orders(OrderId),
        AssessmentId uniqueidentifier NULL REFERENCES dbo.Assessments(AssessmentId),
        AcknowledgedBy uniqueidentifier NULL REFERENCES dbo.Accounts(AccountId),
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ClosedAt datetime2 NULL,
        CONSTRAINT CK_CheckoutTickets_Target CHECK (
            (OrderId IS NOT NULL AND AssessmentId IS NULL) OR
            (AssessmentId IS NOT NULL AND OrderId IS NULL))
    );
    CREATE UNIQUE INDEX UX_Tickets_OpenOrder ON dbo.CheckoutTickets(OrderId) WHERE OrderId IS NOT NULL AND ClosedAt IS NULL;
    CREATE UNIQUE INDEX UX_Tickets_OpenAssessment ON dbo.CheckoutTickets(AssessmentId) WHERE AssessmentId IS NOT NULL AND ClosedAt IS NULL;
END;

IF OBJECT_ID(N'dbo.TicketNotes', N'U') IS NULL
    CREATE TABLE dbo.TicketNotes (
        NoteId uniqueidentifier NOT NULL CONSTRAINT PK_TicketNotes PRIMARY KEY,
        TicketId uniqueidentifier NOT NULL REFERENCES dbo.CheckoutTickets(TicketId),
        AuthorId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        Body nvarchar(2000) NOT NULL,
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
    CREATE TABLE dbo.Notifications (
        NotificationId uniqueidentifier NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
        StudentId uniqueidentifier NULL REFERENCES dbo.Accounts(AccountId),
        Audience nvarchar(30) NOT NULL CHECK (Audience IN (N'Student', N'Cashier')),
        Title nvarchar(200) NOT NULL,
        Body nvarchar(2000) NOT NULL,
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

IF OBJECT_ID(N'dbo.NotificationReads', N'U') IS NULL
    CREATE TABLE dbo.NotificationReads (
        NotificationId uniqueidentifier NOT NULL REFERENCES dbo.Notifications(NotificationId),
        AccountId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        ReadAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_NotificationReads PRIMARY KEY (NotificationId, AccountId)
    );

IF OBJECT_ID(N'dbo.StockMovements', N'U') IS NULL
    CREATE TABLE dbo.StockMovements (
        MovementId uniqueidentifier NOT NULL CONSTRAINT PK_StockMovements PRIMARY KEY,
        ProductId nvarchar(64) NOT NULL REFERENCES dbo.Products(ProductId),
        Size nvarchar(30) NOT NULL,
        QuantityChange int NOT NULL,
        Kind nvarchar(50) NOT NULL,
        Reference nvarchar(100) NULL,
        StaffId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

IF OBJECT_ID(N'dbo.CartItems', N'U') IS NULL
    CREATE TABLE dbo.CartItems (
        StudentId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        ProductId nvarchar(64) NOT NULL REFERENCES dbo.Products(ProductId),
        Size nvarchar(30) NOT NULL,
        Quantity int NOT NULL CHECK (Quantity > 0),
        CONSTRAINT PK_CartItems PRIMARY KEY (StudentId, ProductId, Size)
    );

IF OBJECT_ID(N'dbo.SavedProducts', N'U') IS NULL
    CREATE TABLE dbo.SavedProducts (
        StudentId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(AccountId),
        ProductId nvarchar(64) NOT NULL REFERENCES dbo.Products(ProductId),
        CONSTRAINT PK_SavedProducts PRIMARY KEY (StudentId, ProductId)
    );

COMMIT TRANSACTION;
